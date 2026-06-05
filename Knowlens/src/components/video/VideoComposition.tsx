import { AbsoluteFill, Img, interpolate, useCurrentFrame } from "remotion";
import { Fragment } from "react";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import {
  buildSceneTransitions,
  DEFAULT_TRANSITION_FPS,
  DEFAULT_TRANSITION_PRESET,
  type BuildSceneTransitionsOptions,
  type SceneTransition,
  type TransitionPresetId,
} from "@/lib/video/transitions";

export type VideoCompositionScene = {
  id: string;
  title?: string;
  voiceover?: string;
  chapterTitle?: string;
  imageSrc: string;
  durationFrames: number;
};

export type VideoCompositionProps = {
  scenes: VideoCompositionScene[];
  fps?: number;
  transitionPreset?: TransitionPresetId;
  transitions?: SceneTransition[];
  backgroundColor?: string;
};

function remotionDirection(direction: SceneTransition["direction"]) {
  if (direction === "left") {
    return "from-left";
  }
  if (direction === "up") {
    return "from-top";
  }
  if (direction === "down") {
    return "from-bottom";
  }
  return "from-right";
}

export function getTransitionTiming(transition: SceneTransition) {
  return linearTiming({
    durationInFrames: transition.durationFrames,
  });
}

export function getTransitionPresentation(transition: SceneTransition) {
  if (transition.type === "wipe") {
    return wipe({ direction: remotionDirection(transition.direction) as never });
  }
  if (transition.type === "slide") {
    return slide({ direction: remotionDirection(transition.direction) as never });
  }
  return fade();
}

export function StaticImageScene({
  imageSrc,
  title,
  backgroundColor = "#0B0B0F",
}: {
  imageSrc: string;
  title?: string;
  backgroundColor?: string;
}) {
  return (
    <AbsoluteFill style={{ backgroundColor }}>
      <Img
        src={imageSrc}
        alt={title || "KnowLens scene"}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          objectPosition: "center",
        }}
      />
    </AbsoluteFill>
  );
}

export function SceneTransitionRenderer({
  transition,
  progress,
}: {
  transition: SceneTransition;
  progress: number;
}) {
  if (transition.type === "dip_to_color") {
    const opacity = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
    return (
      <AbsoluteFill
        style={{
          backgroundColor: transition.color || "#0B0B0F",
          opacity,
          pointerEvents: "none",
        }}
      />
    );
  }

  if (transition.type === "light_sweep") {
    const strength = transition.intensity === "strong" ? 0.34 : transition.intensity === "subtle" ? 0.16 : 0.24;
    const left = interpolate(progress, [0, 1], [-28, 128]);
    return (
      <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            top: "-12%",
            bottom: "-12%",
            left: `${left}%`,
            width: "18%",
            transform: "skewX(-16deg)",
            background:
              "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%)",
            opacity: strength,
            filter: "blur(2px)",
          }}
        />
      </AbsoluteFill>
    );
  }

  return null;
}

export function VideoComposition({
  scenes,
  fps = DEFAULT_TRANSITION_FPS,
  transitionPreset = DEFAULT_TRANSITION_PRESET,
  transitions,
  backgroundColor = "#0B0B0F",
}: VideoCompositionProps) {
  const fallbackTransitions =
    transitions ??
    buildSceneTransitions(
      scenes.map((scene) => ({
        id: scene.id,
        title: scene.title,
        voiceover: scene.voiceover,
        chapterTitle: scene.chapterTitle,
      })),
      {
        fps,
        preset: transitionPreset,
        color: backgroundColor,
      } satisfies BuildSceneTransitionsOptions,
    );

  return (
    <TransitionSeries>
      {scenes.map((scene, index) => {
        const transition = fallbackTransitions[index];
        return (
          <Fragment key={`scene-block-${scene.id}`}>
            <TransitionSeries.Sequence key={`scene-${scene.id}`} durationInFrames={scene.durationFrames}>
              <StaticImageScene imageSrc={scene.imageSrc} title={scene.title} backgroundColor={backgroundColor} />
            </TransitionSeries.Sequence>
            {transition ? (
              <TransitionSeries.Transition
                key={`transition-${transition.fromSceneId}-${transition.toSceneId}`}
                presentation={getTransitionPresentation(transition) as never}
                timing={getTransitionTiming(transition)}
              />
            ) : null}
          </Fragment>
        );
      })}
    </TransitionSeries>
  );
}

export function TransitionOverlayComposition({
  transition,
}: {
  transition: SceneTransition;
}) {
  const frame = useCurrentFrame();
  const progress = Math.max(0, Math.min(1, frame / Math.max(1, transition.durationFrames - 1)));
  return <SceneTransitionRenderer transition={transition} progress={progress} />;
}
