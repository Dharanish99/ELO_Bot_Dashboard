from __future__ import annotations

from dataclasses import dataclass, field
import math
import time
from typing import Optional

import cv2
import numpy as np


def iou(a, b):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    inter = iw * ih
    if inter <= 0:
        return 0.0
    aa = max(0.0, ax2-ax1) * max(0.0, ay2-ay1)
    bb = max(0.0, bx2-bx1) * max(0.0, by2-by1)
    return inter / max(aa + bb - inter, 1e-9)


def center(b):
    return ((b[0]+b[2])*0.5, (b[1]+b[3])*0.5)


def area_frac(b):
    return max(0.0, b[2]-b[0]) * max(0.0, b[3]-b[1])


def size_ratio(a, b):
    aa = max(area_frac(a), 1e-6)
    bb = max(area_frac(b), 1e-6)
    return max(aa, bb) / min(aa, bb)


def appearance_hist(frame_rgb, bbox, h_bins, s_bins):
    h, w = frame_rgb.shape[:2]
    x1, y1, x2, y2 = [int(max(0, v)) for v in bbox]
    x1, x2 = min(x1, w-1), min(max(x1+1, x2), w)
    y1, y2 = min(y1, h-1), min(max(y1+1, y2), h)
    if x2 <= x1 or y2 <= y1:
        return None
    # Favor the central torso area to reduce background contamination.
    yy1 = y1 + int(0.15*(y2-y1))
    yy2 = y1 + int(0.85*(y2-y1))
    xx1 = x1 + int(0.15*(x2-x1))
    xx2 = x1 + int(0.85*(x2-x1))
    crop = frame_rgb[yy1:yy2, xx1:xx2]
    if crop.size == 0:
        return None
    hsv = cv2.cvtColor(crop, cv2.COLOR_RGB2HSV)
    hist = cv2.calcHist([hsv], [0, 1], None, [h_bins, s_bins], [0, 180, 0, 256])
    hist = cv2.normalize(hist, hist).flatten().astype(np.float32)
    return hist


def hist_distance(a, b):
    if a is None or b is None:
        return 1.0
    # Bhattacharyya distance is 0 for equal histograms and 1 for very different ones.
    return float(cv2.compareHist(a.astype(np.float32), b.astype(np.float32), cv2.HISTCMP_BHATTACHARYYA))


@dataclass
class Track:
    id: int
    bbox: list[float]
    score: float
    hits: int = 1
    age: int = 1
    misses: int = 0
    vx: float = 0.0
    vy: float = 0.0
    area_v: float = 0.0
    last_update: float = field(default_factory=time.monotonic)
    last_side: str = "center"
    appearance: Optional[np.ndarray] = None

    def predicted_bbox(self, dt: float):
        dx = self.vx * dt
        dy = self.vy * dt
        return [self.bbox[0]+dx, self.bbox[1]+dy, self.bbox[2]+dx, self.bbox[3]+dy]


class LightweightPeopleTracker:
    """ByteTrack-inspired lean tracker: high-score association, low-score recovery,
    constant-velocity prediction, IoU+center+appearance cost. No extra ML model."""

    def __init__(self, cfg):
        self.cfg = cfg
        self.tracks: list[Track] = []
        self.next_id = 1
        self.frame_index = 0
        self.selected_id = None
        self.selection_anchor = None

    def _cost(self, track: Track, det, frame_shape):
        h, w = frame_shape[:2]
        db = [det["bbox"][0], det["bbox"][1], det["bbox"][2], det["bbox"][3]]
        pred = track.predicted_bbox(max(0.0, time.monotonic() - track.last_update))
        ov = iou(pred, db)
        cx, cy = center(pred); dx, dy = center(db)
        diag = max(1.0, math.hypot(w, h))
        dist = math.hypot(cx-dx, cy-dy) / diag
        size_r = size_ratio(pred, db)
        ad = hist_distance(track.appearance, det.get("appearance"))
        # Hard gates keep IDs from jumping between distant people.
        if ov < self.cfg.iou_gate and math.hypot(cx-dx, cy-dy) > self.cfg.center_gate_px:
            return None
        if size_r > self.cfg.size_ratio_gate:
            return None
        if track.appearance is not None and det.get("appearance") is not None and ad > self.cfg.appearance_gate:
            return None
        return (self.cfg.iou_weight * (1.0-ov)
                + self.cfg.motion_weight * min(1.0, dist*3.0)
                + self.cfg.appearance_weight * ad)

    def _greedy_match(self, tracks, detections, frame_shape):
        pairs = []
        for ti, tr in enumerate(tracks):
            for di, det in enumerate(detections):
                c = self._cost(tr, det, frame_shape)
                if c is not None:
                    pairs.append((c, ti, di))
        pairs.sort(key=lambda x: x[0])
        used_t, used_d, matches = set(), set(), []
        for c, ti, di in pairs:
            if ti in used_t or di in used_d:
                continue
            used_t.add(ti); used_d.add(di); matches.append((ti, di, c))
        return matches, used_t, used_d

    def select(self, track_id):
        track = next((t for t in self.tracks if t.id == int(track_id) and t.misses == 0), None)
        if track is None:
            return False
        self.selected_id = track.id
        self.selection_anchor = {
            "bbox": list(track.bbox),
            "vx": track.vx, "vy": track.vy,
            "appearance": None if track.appearance is None else track.appearance.copy(),
            "updated": time.monotonic(),
        }
        return True

    def selected_snapshot(self):
        if self.selected_id is None:
            return None
        return next((t for t in self.tracks if t.id == self.selected_id and t.misses == 0), None)

    def try_reacquire_selected(self, frame_shape):
        if self.selected_id is None or not self.selection_anchor:
            return None
        anchor = self.selection_anchor
        dt = min(1.5, max(0.0, time.monotonic()-anchor["updated"]))
        pred = [anchor["bbox"][0]+anchor["vx"]*dt, anchor["bbox"][1]+anchor["vy"]*dt,
                anchor["bbox"][2]+anchor["vx"]*dt, anchor["bbox"][3]+anchor["vy"]*dt]
        candidates=[]
        for t in self.tracks:
            if t.misses != 0:
                continue
            ov=iou(pred,t.bbox)
            dist=math.hypot(center(pred)[0]-center(t.bbox)[0], center(pred)[1]-center(t.bbox)[1])
            ad=hist_distance(anchor.get("appearance"),t.appearance)
            sr=size_ratio(pred,t.bbox)
            if (ov >= max(0.10,self.cfg.iou_gate) or dist <= self.cfg.center_gate_px*1.15) and sr <= 2.2 and ad <= min(0.70,self.cfg.appearance_gate+0.10):
                score=0.55*(1-ov)+0.25*min(1.0,dist/max(1.0,self.cfg.center_gate_px))+0.20*ad
                candidates.append((score,t))
        if not candidates:
            return None
        candidates.sort(key=lambda x:x[0])
        best=candidates[0][1]
        # Require separation from runner-up to avoid remapping during crossings.
        if len(candidates)>1 and candidates[0][0] > candidates[1][0]*0.85:
            return None
        self.selected_id=best.id
        self.selection_anchor={"bbox":list(best.bbox),"vx":best.vx,"vy":best.vy,"appearance":None if best.appearance is None else best.appearance.copy(),"updated":time.monotonic()}
        return best

    def update(self, detections, frame_rgb):
        self.frame_index += 1
        h, w = frame_rgb.shape[:2]
        self._frame_width = w
        prepared = []
        for d in detections:
            x1, y1, x2, y2 = d["bbox_norm"]
            bbox = [x1*w, y1*h, x2*w, y2*h]
            dd = dict(d)
            dd["bbox"] = bbox
            dd["appearance"] = appearance_hist(frame_rgb, bbox, self.cfg.hist_h_bins, self.cfg.hist_s_bins)
            prepared.append(dd)

        high = [d for d in prepared if d["score"] >= self.cfg.confidence_high]
        low = [d for d in prepared if self.cfg.confidence_low <= d["score"] < self.cfg.confidence_high]

        active = [t for t in self.tracks if t.misses <= self.cfg.track_buffer_frames]
        matches, used_t, used_d = self._greedy_match(active, high, frame_rgb.shape)

        for ti, di, _ in matches:
            tr = active[ti]; det = high[di]
            self._update_track(tr, det)

        unmatched_tracks = [active[i] for i in range(len(active)) if i not in used_t]
        unmatched_low = [low[i] for i in range(len(low)) if i not in used_d]  # used_d is high-index; harmless here
        # Second association to low-confidence detections, following ByteTrack's core idea.
        low_matches, _, used_low = self._greedy_match(unmatched_tracks, low, frame_rgb.shape)
        for ti, di, _ in low_matches:
            self._update_track(unmatched_tracks[ti], low[di])

        matched_ids = {tr.id for tr in self.tracks if tr.last_update >= time.monotonic()-0.05}
        for tr in self.tracks:
            if tr.id not in matched_ids:
                tr.age += 1
                tr.misses += 1

        # Spawn new tracks from unmatched high-confidence detections.
        matched_high_ids = {di for _, di, _ in matches}
        for di, det in enumerate(high):
            if di in matched_high_ids:
                continue
            if len(self.tracks) >= self.cfg.max_tracks:
                break
            b = det["bbox"]
            cx, cy = center(b)
            self.tracks.append(Track(self.next_id, list(b), det["score"], appearance=det.get("appearance")))
            self.tracks[-1].last_side = self._side(cx, w)
            self.next_id += 1

        self.tracks = [t for t in self.tracks if t.misses <= self.cfg.track_buffer_frames]
        if self.selected_id is not None:
            selected = next((t for t in self.tracks if t.id == self.selected_id and t.misses == 0), None)
            if selected is not None:
                self.selection_anchor={"bbox":list(selected.bbox),"vx":selected.vx,"vy":selected.vy,"appearance":None if selected.appearance is None else selected.appearance.copy(),"updated":time.monotonic()}
            else:
                self.try_reacquire_selected(frame_rgb.shape)
        return self.snapshot(w, h)

    def _update_track(self, tr: Track, det):
        now = time.monotonic()
        dt = max(1e-3, now - tr.last_update)
        old_cx, old_cy = center(tr.bbox)
        nb = det["bbox"]
        new_cx, new_cy = center(nb)
        alpha = 0.65
        tr.vx = (new_cx-old_cx)/dt
        tr.vy = (new_cy-old_cy)/dt
        tr.bbox = [alpha*nb[i] + (1-alpha)*tr.bbox[i] for i in range(4)]
        tr.score = det["score"]
        tr.hits += 1
        tr.misses = 0
        tr.last_update = now
        if det.get("appearance") is not None:
            if tr.appearance is None:
                tr.appearance = det["appearance"]
            else:
                tr.appearance = (1-self.cfg.hist_update_alpha)*tr.appearance + self.cfg.hist_update_alpha*det["appearance"]
        cx, _ = center(tr.bbox)
        # Use the current frame width supplied during update; 640 is only the default camera width.
        tr.last_side = self._side(cx, getattr(self, "_frame_width", 640))

    @staticmethod
    def _side(cx, width):
        f = cx / max(1, width)
        if f < 0.4:
            return "left"
        if f > 0.6:
            return "right"
        return "center"

    def snapshot(self, w, h):
        out = []
        now = time.monotonic()
        for t in self.tracks:
            out.append({
                "id": t.id,
                "bbox": [float(v) for v in t.bbox],
                "score": float(t.score),
                "hits": t.hits,
                "misses": t.misses,
                "age_s": max(0.0, now-t.last_update),
                "last_side": t.last_side,
                "area_fraction": area_frac(t.bbox)/(w*h),
            })
        return out
