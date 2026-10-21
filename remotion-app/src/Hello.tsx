import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';

export const Hello: React.FC = () => {
	const opacity = interpolate(useCurrentFrame(), [0, 30], [0, 1], {extrapolateRight: 'clamp'});
	return (
		<AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', background: '#fff', fontSize: 100, opacity}}>
			Hello Remotion
		</AbsoluteFill>
	);
};
