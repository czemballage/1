import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';

export const Hello: React.FC = () => {
	const frame = useCurrentFrame();
	const {fps, durationInFrames} = useVideoConfig();
	const pop = spring({frame, fps, config: {damping: 12}});
	const slide = interpolate(frame, [30, 60], [60, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const sub = interpolate(frame, [30, 60], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
	const fade = interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0]);
	const hue = interpolate(frame, [0, durationInFrames], [220, 300]);
	return (
		<AbsoluteFill
			style={{
				background: `linear-gradient(135deg, hsl(${hue},70%,35%), hsl(${hue + 40},70%,20%))`,
				justifyContent: 'center',
				alignItems: 'center',
				color: 'white',
				fontFamily: 'sans-serif',
				opacity: fade,
			}}
		>
			<div style={{fontSize: 130, fontWeight: 800, transform: `scale(${pop})`}}>مرحبا Remotion</div>
			<div style={{fontSize: 48, marginTop: 20, opacity: sub, transform: `translateY(${slide}px)`}}>
				فيديو تجريبي مصنوع بالكود
			</div>
		</AbsoluteFill>
	);
};
