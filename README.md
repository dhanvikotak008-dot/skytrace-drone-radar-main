# Skytrace Drone Radar

Build a complete, modern, professional, interactive web application for my engineering project.

PROJECT TITLE:
LONG-RANGE DRONE DETECTION AND TRACKING SYSTEM USING RADAR AND MICRO-DOPPLER SIGNATURE ANALYSIS.

IMPORTANT:
This is an engineering project demonstration and simulation platform. It should visually demonstrate how radar technology, signal processing, IoT and AI can be used to detect and monitor drones from a distance.

The application should look like a professional aerospace surveillance and radar monitoring system.

DESIGN AND THEME:

Use a dark futuristic interface inspired by professional radar monitoring stations.

Design requirements:
- Dark navy and black background.
- Neon green radar elements.
- Cyan and blue highlights.
- Red and orange warning indicators.
- Modern typography.
- Smooth animations.
- Professional charts and graphs.
- Responsive design.
- Clean sidebar navigation.
- High-quality visualizations.

Do not make it look like a basic student dashboard or an ordinary admin panel.

PAGE 1: MAIN RADAR DASHBOARD

Create a main dashboard showing:

1. Live radar simulation.
2. Circular radar scanning animation.
3. Simulated aerial targets appearing on the radar.
4. Unique ID for each detected object.
5. Distance of each target from the radar station.
6. Estimated altitude.
7. Estimated speed.
8. Direction of movement.
9. Detection timestamp.
10. Object classification.

Show multiple moving targets.

Allow the user to start, stop and reset the radar simulation.

PAGE 2: DRONE DETECTION

Create a dedicated drone detection page.

Display:
- Drone detection status.
- Estimated detection range.
- Target distance.
- Estimated altitude.
- Horizontal and vertical velocity.
- Direction of movement.
- Signal strength.
- Detection confidence.

Show simulated drone targets approaching, moving away and changing directions.

PAGE 3: MICRO-DOPPLER ANALYSIS

This is one of the most important pages.

Create an interactive micro-Doppler analysis interface.

Show:
- Synthetic radar signal visualization.
- Doppler frequency graph.
- Micro-Doppler spectrogram.
- Time-frequency analysis.
- Simulated rotor modulation patterns.
- Comparison between drone-like and bird-like signatures.

Use a heatmap-style spectrogram with frequency on the vertical axis and time on the horizontal axis.

Include an explanation of how rotating drone propellers produce distinctive micro-Doppler patterns.

Use synthetic demonstration data and clearly label it as simulated.

PAGE 4: OBJECT CLASSIFICATION

Create an AI classification interface.

Include the following object classes:
- Drone-like object.
- Bird-like object.
- Other moving object.
- Unknown object.

Display:
- Predicted class.
- Classification confidence.
- Signal characteristics.
- Micro-Doppler signature comparison.
- Classification history.

Clearly indicate that this is a simulated AI classification model and not a validated real-world detector.

PAGE 5: DRONE TRACKING

Create an interactive tracking interface.

Show:
- 2D radar tracking.
- 3D airspace visualization.
- Target coordinates.
- Estimated distance.
- Altitude.
- Speed.
- Direction.
- Previous trajectory.
- Predicted future trajectory.
- Position uncertainty.

Allow multiple simulated objects to move simultaneously.

PAGE 6: SENSOR MONITORING

Create a sensor monitoring page.

Include simulated sensor inputs:
- FMCW radar.
- Radar receiver.
- Camera.
- Optional RF detection indicator.
- IoT monitoring device.

Show sensor status, signal quality, connectivity and simulated readings.

Do not imply that physical sensors are connected unless an actual connection exists.

PAGE 7: RISK AND ALERT MONITORING

Create a defensive monitoring system.

Display:
- Protected airspace.
- Restricted-zone entry alerts.
- Unusual movement indicators.
- Detection confidence.
- Monitoring priority.

Use:
- LOW
- MEDIUM
- HIGH

Include an event log with timestamps.

Do not implement interception, jamming, weapon targeting or destructive countermeasures.

PAGE 8: SIMULATION CONTROL CENTER

Allow users to control the simulation.

Add:
- Start simulation.
- Pause simulation.
- Reset simulation.
- Add simulated target.
- Select target type.
- Change initial distance.
- Change altitude.
- Change speed.
- Change direction.
- Change sensor noise.
- Simulate sensor failure.

All controls must actually work and update the dashboard.

TECHNICAL REQUIREMENTS:

Use:
- React.
- TypeScript.
- Tailwind CSS.
- Recharts for charts.
- Three.js or React Three Fiber for 3D visualization.
- Lucide icons.

Implement realistic-looking synthetic radar data.

Use mathematical models for:
- Radar range estimation.
- Doppler frequency shift.
- Micro-Doppler signal simulation.
- Short-Time Fourier Transform visualization.
- Target tracking.
- Trajectory estimation.

Make the simulation interactive and continuously update the visualizations.

IMPORTANT FUNCTIONAL REQUIREMENTS:

1. Do not create static screenshots disguised as a working application.
2. Every navigation item must work.
3. Every simulation control must work.
4. Charts must use generated data.
5. Radar targets must move dynamically.
6. The 3D visualization must be interactive.
7. The spectrogram must update when the selected target changes.
8. Use consistent target IDs across all pages.
9. Keep simulated data separate from actual sensor measurements.
10. Do not display fabricated real-world detection accuracy or actual radar range claims.

FINAL EXPECTATION:

Build a complete, polished and interactive engineering demonstration platform that allows my team and professors to understand how long-range drone detection using radar and micro-Doppler analysis works.

The website should look like a professional aerospace engineering research prototype.

Prioritize functionality, realistic visualization, scientific explanations and presentation quality.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ec4355fd-39ec-46b5-b4d9-3bb7e43e2d29).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
