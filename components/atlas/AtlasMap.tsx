"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import styles from "./Atlas.module.css";
import {
  categoryMark,
  type AtlasLocation,
  type AtlasRole,
} from "./atlasTypes";

const MAP_WIDTH = 2048;
const MAP_HEIGHT = 1365;

type ViewState = {
  scale: number;
  x: number;
  y: number;
};

type PlacementMode = "add" | "move" | null;

type AtlasMapProps = {
  locations: AtlasLocation[];
  selectedLocationId: string | null;
  role: AtlasRole;
  previewAsPlayer: boolean;
  placementMode: PlacementMode;
  focusLocation: AtlasLocation | null;
  focusNonce: number;
  onSelectLocation: (location: AtlasLocation) => void;
  onPlaceLocation: (xPercent: number, yPercent: number) => void;
};

type Point = { x: number; y: number };

type PanGesture = {
  pointerId: number;
  startPoint: Point;
  startView: ViewState;
};

type PinchGesture = {
  startDistance: number;
  startScale: number;
  anchorMapPoint: Point;
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function pointDistance(first: Point, second: Point) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function pointMidpoint(first: Point, second: Point): Point {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

function publicLocationName(location: AtlasLocation) {
  if (location.visibility_status === "rumored") {
    return location.rumor_name?.trim() || "Whisper in the Mists";
  }
  return location.name;
}

function markerAriaLabel(
  location: AtlasLocation,
  role: AtlasRole,
  previewAsPlayer: boolean
) {
  const gmView = role === "dm" && !previewAsPlayer;
  const name = gmView ? location.name : publicLocationName(location);
  return `${name}. ${location.visibility_status}.`;
}

export function AtlasMap({
  locations,
  selectedLocationId,
  role,
  previewAsPlayer,
  placementMode,
  focusLocation,
  focusNonce,
  onSelectLocation,
  onPlaceLocation,
}: AtlasMapProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const fitScaleRef = useRef(0.5);
  const pointerPositionsRef = useRef(new Map<number, Point>());
  const panGestureRef = useRef<PanGesture | null>(null);
  const pinchGestureRef = useRef<PinchGesture | null>(null);
  const movedRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [view, setView] = useState<ViewState>({ scale: 0.5, x: 0, y: 0 });

  const clampView = useCallback((candidate: ViewState) => {
    const viewport = viewportRef.current;
    if (!viewport) return candidate;

    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;
    const scaledWidth = MAP_WIDTH * candidate.scale;
    const scaledHeight = MAP_HEIGHT * candidate.scale;
    const edgeAllowance = 72;

    const x =
      scaledWidth <= viewportWidth
        ? (viewportWidth - scaledWidth) / 2
        : clamp(
            candidate.x,
            viewportWidth - scaledWidth - edgeAllowance,
            edgeAllowance
          );
    const y =
      scaledHeight <= viewportHeight
        ? (viewportHeight - scaledHeight) / 2
        : clamp(
            candidate.y,
            viewportHeight - scaledHeight - edgeAllowance,
            edgeAllowance
          );

    return { ...candidate, x, y };
  }, []);

  const fitMap = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const scale = Math.min(
      viewport.clientWidth / MAP_WIDTH,
      viewport.clientHeight / MAP_HEIGHT
    );
    fitScaleRef.current = scale;
    setView(
      clampView({
        scale,
        x: (viewport.clientWidth - MAP_WIDTH * scale) / 2,
        y: (viewport.clientHeight - MAP_HEIGHT * scale) / 2,
      })
    );
  }, [clampView]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const observer = new ResizeObserver(() => fitMap());
    observer.observe(viewport);
    fitMap();

    return () => observer.disconnect();
  }, [fitMap]);

  const zoomAtPoint = useCallback(
    (requestedScale: number, point: Point) => {
      setView((current) => {
        const minimum = fitScaleRef.current * 0.82;
        const maximum = Math.max(3.6, fitScaleRef.current * 7);
        const scale = clamp(requestedScale, minimum, maximum);
        const mapX = (point.x - current.x) / current.scale;
        const mapY = (point.y - current.y) / current.scale;

        return clampView({
          scale,
          x: point.x - mapX * scale,
          y: point.y - mapY * scale,
        });
      });
    },
    [clampView]
  );

  const zoomByFactorAtPoint = useCallback(
    (factor: number, point: Point) => {
      setView((current) => {
        const minimum = fitScaleRef.current * 0.82;
        const maximum = Math.max(3.6, fitScaleRef.current * 7);
        const scale = clamp(current.scale * factor, minimum, maximum);
        const mapX = (point.x - current.x) / current.scale;
        const mapY = (point.y - current.y) / current.scale;

        return clampView({
          scale,
          x: point.x - mapX * scale,
          y: point.y - mapY * scale,
        });
      });
    },
    [clampView]
  );

  const zoomFromCenter = useCallback(
    (factor: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;
      zoomAtPoint(view.scale * factor, {
        x: viewport.clientWidth / 2,
        y: viewport.clientHeight / 2,
      });
    },
    [view.scale, zoomAtPoint]
  );

  useEffect(() => {
  const viewport = viewportRef.current;

  if (!viewport) {
    return;
  }

  // Create a non-null reference for the event handler closure.
  const viewportElement: HTMLDivElement = viewport;

  function handleWheel(event: WheelEvent) {
    event.preventDefault();
    event.stopPropagation();

    const rect = viewportElement.getBoundingClientRect();
    const normalizedDelta = clamp(event.deltaY, -120, 120);
    const factor = Math.exp(-normalizedDelta * 0.0022);

    zoomByFactorAtPoint(factor, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }

  viewportElement.addEventListener("wheel", handleWheel, {
    passive: false,
  });

  return () => {
    viewportElement.removeEventListener("wheel", handleWheel);
  };
}, [zoomByFactorAtPoint]);

  useEffect(() => {
    if (!focusLocation || focusNonce === 0) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    setView((current) => {
      const scale = Math.max(current.scale, fitScaleRef.current * 2.05);
      const mapX = (focusLocation.x_percent / 100) * MAP_WIDTH;
      const mapY = (focusLocation.y_percent / 100) * MAP_HEIGHT;
      return clampView({
        scale,
        x: viewport.clientWidth / 2 - mapX * scale,
        y: viewport.clientHeight / 2 - mapY * scale,
      });
    });
  }, [clampView, focusLocation, focusNonce]);

  const beginPinch = useCallback(() => {
    const points = [...pointerPositionsRef.current.values()];
    if (points.length < 2) return;
    const first = points[0];
    const second = points[1];
    const midpoint = pointMidpoint(first, second);

    pinchGestureRef.current = {
      startDistance: Math.max(1, pointDistance(first, second)),
      startScale: view.scale,
      anchorMapPoint: {
        x: (midpoint.x - view.x) / view.scale,
        y: (midpoint.y - view.y) / view.scale,
      },
    };
    panGestureRef.current = null;
  }, [view]);

  function localPoint(event: ReactPointerEvent<HTMLDivElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const point = localPoint(event);
    pointerPositionsRef.current.set(event.pointerId, point);
    event.currentTarget.setPointerCapture(event.pointerId);
    movedRef.current = false;
    setDragging(true);

    if (pointerPositionsRef.current.size >= 2) {
      beginPinch();
      return;
    }

    panGestureRef.current = {
      pointerId: event.pointerId,
      startPoint: point,
      startView: view,
    };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointerPositionsRef.current.has(event.pointerId)) return;
    const point = localPoint(event);
    pointerPositionsRef.current.set(event.pointerId, point);

    if (pointerPositionsRef.current.size >= 2) {
      const points = [...pointerPositionsRef.current.values()];
      const first = points[0];
      const second = points[1];
      const gesture = pinchGestureRef.current;
      if (!gesture) {
        beginPinch();
        return;
      }

      const midpoint = pointMidpoint(first, second);
      const distance = Math.max(1, pointDistance(first, second));
      const minimum = fitScaleRef.current * 0.82;
      const maximum = Math.max(3.6, fitScaleRef.current * 7);
      const scale = clamp(
        gesture.startScale * (distance / gesture.startDistance),
        minimum,
        maximum
      );
      movedRef.current = true;
      setView(
        clampView({
          scale,
          x: midpoint.x - gesture.anchorMapPoint.x * scale,
          y: midpoint.y - gesture.anchorMapPoint.y * scale,
        })
      );
      return;
    }

    const pan = panGestureRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;

    const deltaX = point.x - pan.startPoint.x;
    const deltaY = point.y - pan.startPoint.y;
    if (Math.hypot(deltaX, deltaY) > 4) movedRef.current = true;

    setView(
      clampView({
        ...pan.startView,
        x: pan.startView.x + deltaX,
        y: pan.startView.y + deltaY,
      })
    );
  }

  function finishPointer(event: ReactPointerEvent<HTMLDivElement>) {
    pointerPositionsRef.current.delete(event.pointerId);

    if (pointerPositionsRef.current.size === 1) {
      const remaining = [...pointerPositionsRef.current.entries()][0];
      if (remaining) {
        const [pointerId, point] = remaining;
        panGestureRef.current = {
          pointerId,
          startPoint: point,
          startView: view,
        };
      }
      pinchGestureRef.current = null;
    } else if (pointerPositionsRef.current.size === 0) {
      panGestureRef.current = null;
      pinchGestureRef.current = null;
      setDragging(false);
    }
  }

  function onMapClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (!placementMode || movedRef.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const viewportX = event.clientX - rect.left;
    const viewportY = event.clientY - rect.top;
    const mapX = (viewportX - view.x) / view.scale;
    const mapY = (viewportY - view.y) / view.scale;

    if (mapX < 0 || mapY < 0 || mapX > MAP_WIDTH || mapY > MAP_HEIGHT) {
      return;
    }

    onPlaceLocation(
      clamp((mapX / MAP_WIDTH) * 100, 0, 100),
      clamp((mapY / MAP_HEIGHT) * 100, 0, 100)
    );
  }

  const zoomPercent = Math.round((view.scale / fitScaleRef.current) * 100);

  const stageStyle = useMemo<CSSProperties>(
    () => ({ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.scale})` }),
    [view]
  );

  return (
    <div className={styles.atlasShell}>
      <div
        ref={viewportRef}
        className={styles.mapViewport}
        data-dragging={dragging}
        data-placement={Boolean(placementMode)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onClick={onMapClick}
      >
        <div className={styles.mapStage} style={stageStyle}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/barovia/maps/barovia-no-names.webp"
            alt="Unlabelled parchment map of Barovia"
            className={styles.mapImage}
            draggable={false}
          />
          <div className={styles.mapShade} />

          {locations.map((location) => {
            const selected = location.id === selectedLocationId;
            const gmView = role === "dm" && !previewAsPlayer;
            const label = gmView ? location.name : publicLocationName(location);
            const markerStyle: CSSProperties = {
              left: `${location.x_percent}%`,
              top: `${location.y_percent}%`,
            };
            const markerScaleStyle: CSSProperties = {
              transform: `scale(${1 / view.scale})`,
            };

            return (
              <div
                key={location.id}
                className={styles.markerAnchor}
                style={markerStyle}
              >
                <div className={styles.markerScale} style={markerScaleStyle}>
                  {(selected || location.visibility_status === "rumored") && (
                    <span className={styles.markerPulse} />
                  )}
                  <button
                    type="button"
                    className={styles.markerButton}
                    data-selected={selected}
                    data-visibility={location.visibility_status}
                    aria-label={markerAriaLabel(location, role, previewAsPlayer)}
                    title={label}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectLocation(location);
                    }}
                  >
                    {location.visibility_status === "rumored" && !gmView
                      ? "?"
                      : categoryMark(location.category)}
                  </button>
                  {selected && (
                    <span className={styles.markerLabel}>{label}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.mistLayer} />

        <div
          className={styles.mapControls}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className={styles.controlButton}
            onClick={() => zoomFromCenter(0.78)}
            aria-label="Zoom out"
            title="Zoom out"
          >
            −
          </button>
          <span className={styles.zoomReadout}>{zoomPercent}%</span>
          <button
            type="button"
            className={styles.controlButton}
            onClick={() => zoomFromCenter(1.28)}
            aria-label="Zoom in"
            title="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className={styles.controlButton}
            onClick={fitMap}
            aria-label="Fit entire map"
            title="Fit map"
          >
            Fit
          </button>
        </div>

        <div className={styles.mapHint}>
          {placementMode === "add"
            ? "Choose a point on the map for the new location."
            : placementMode === "move"
              ? "Choose the new position for the selected marker."
              : "Drag to move · wheel or pinch to zoom · tap a marker to inspect it"}
        </div>
      </div>
    </div>
  );
}
