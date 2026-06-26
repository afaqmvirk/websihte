"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { StampPhoto } from "@/components/shared/section-layout";
import { ENVELOPE_CONFIG } from "@/components/stamp/stamp-config";

export type FlyLaunchMeta = {
  fromEl: HTMLElement;
  rotation: number;
  scale: number;
  stampSize: number;
  photoRotateDeg: number;
};

export type FlyRequest = {
  id: string;
  photo: StampPhoto;
  from: DOMRect;
  to: DOMRect;
  startRotation: number;
  startScale: number;
  stampSize: number;
  photoRotateDeg: number;
  envelopeWidth: number;
};

type EnvelopeContextValue = {
  registerEnvelope: (el: HTMLButtonElement | null) => void;
  registerPocket: (el: HTMLDivElement | null) => void;
  registerEntry: (el: HTMLDivElement | null) => void;
  requestFly: (photo: StampPhoto, meta: FlyLaunchMeta) => void;
  flights: FlyRequest[];
  completeFlight: (id: string) => void;
  isOpen: boolean;
  isVisible: boolean;
  setVisible: (visible: boolean) => void;
  collectedStamps: ReadonlySet<string>;
  flyingStamps: ReadonlySet<string>;
  isStampHidden: (src: string) => boolean;
  releaseAllStamps: () => void;
};

const EnvelopeContext = createContext<EnvelopeContextValue | null>(null);

export function EnvelopeProvider({ children }: { children: ReactNode }) {
  const envelopeRef = useRef<HTMLButtonElement | null>(null);
  const pocketRef = useRef<HTMLDivElement | null>(null);
  const entryRef = useRef<HTMLDivElement | null>(null);
  const [flights, setFlights] = useState<FlyRequest[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [collectedStamps, setCollectedStamps] = useState<Set<string>>(
    () => new Set(),
  );
  const [flyingStamps, setFlyingStamps] = useState<Set<string>>(
    () => new Set(),
  );
  const closeTimerRef = useRef<number | null>(null);

  const registerEnvelope = useCallback((el: HTMLButtonElement | null) => {
    envelopeRef.current = el;
  }, []);

  const registerPocket = useCallback((el: HTMLDivElement | null) => {
    pocketRef.current = el;
  }, []);

  const registerEntry = useCallback((el: HTMLDivElement | null) => {
    entryRef.current = el;
  }, []);

  const scheduleClose = useCallback(() => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
      closeTimerRef.current = null;
    }, 560);
  }, []);

  const requestFly = useCallback((photo: StampPhoto, meta: FlyLaunchMeta) => {
    const entry = entryRef.current;
    if (!entry) return;
    if (collectedStamps.has(photo.src) || flyingStamps.has(photo.src)) return;

    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    setIsOpen(true);
    setFlyingStamps((prev) => new Set(prev).add(photo.src));

    const from = meta.fromEl.getBoundingClientRect();
    const to = entry.getBoundingClientRect();
    const entryFraction = parseFloat(ENVELOPE_CONFIG.entryWidth) / 100;
    const shellWidthPx =
      envelopeRef.current?.getBoundingClientRect().width ??
      to.width / entryFraction;
    const envelopeWidth = shellWidthPx * ENVELOPE_CONFIG.engagedScale;
    const id = `${photo.src}-${Date.now()}`;

    setFlights((prev) => [
      ...prev,
      {
        id,
        photo,
        from,
        to,
        startRotation: meta.rotation,
        startScale: meta.scale,
        stampSize: meta.stampSize,
        photoRotateDeg: meta.photoRotateDeg,
        envelopeWidth,
      },
    ]);
  }, [collectedStamps, flyingStamps]);

  const completeFlight = useCallback(
    (id: string) => {
      setFlights((prev) => {
        const flight = prev.find((f) => f.id === id);
        if (flight) {
          setCollectedStamps((stamps) => new Set(stamps).add(flight.photo.src));
          setFlyingStamps((stamps) => {
            const next = new Set(stamps);
            next.delete(flight.photo.src);
            return next;
          });
        }
        const next = prev.filter((f) => f.id !== id);
        if (next.length === 0) {
          scheduleClose();
        }
        return next;
      });
    },
    [scheduleClose],
  );

  const releaseAllStamps = useCallback(() => {
    if (collectedStamps.size === 0) return;

    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    setIsOpen(true);
    setCollectedStamps(new Set());
    scheduleClose();
  }, [collectedStamps.size, scheduleClose]);

  const isStampHidden = useCallback(
    (src: string) => collectedStamps.has(src) || flyingStamps.has(src),
    [collectedStamps, flyingStamps],
  );

  const setVisible = useCallback((visible: boolean) => {
    setIsVisible(visible);
    if (!visible) {
      setIsOpen(false);
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    }
  }, []);

  return (
    <EnvelopeContext.Provider
      value={{
        registerEnvelope,
        registerPocket,
        registerEntry,
        requestFly,
        flights,
        completeFlight,
        isOpen,
        isVisible,
        setVisible,
        collectedStamps,
        flyingStamps,
        isStampHidden,
        releaseAllStamps,
      }}
    >
      {children}
    </EnvelopeContext.Provider>
  );
}

export function useEnvelope() {
  const ctx = useContext(EnvelopeContext);
  if (!ctx) {
    throw new Error("useEnvelope must be used within EnvelopeProvider");
  }
  return ctx;
}
