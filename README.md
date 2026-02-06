# WebGL Lighting and Shading (Phong & Gouraud)

This project is a **WebGL-based 3D application** that demonstrates realistic lighting using the **Phong illumination model**. Objects are rendered under multiple configurable light sources using a **perspective camera**, with real-time interaction through a graphical interface.

## Overview
The scene consists of a platform and multiple 3D primitives, including the Stanford Bunny, illuminated by one or more user-controlled light sources. Lighting calculations can be performed per-vertex (**Gouraud shading**) or per-fragment (**Phong shading**).

## Key Features
- Implementation of the **Phong lighting model** in GLSL
- Support for **Phong and Gouraud shading**
- Multiple light sources (point, directional, and spotlight)
- Real-time light and material control via **dat.gui**
- Adjustable material properties (Ka, Kd, Ks, shininess)
- Interactive camera control and perspective projection tuning
- Back-face culling and depth buffer toggles
- Full-window responsive rendering with correct aspect ratio

## Technical Skills Demonstrated
- WebGL and GLSL shader programming
- Lighting and shading models in computer graphics
- Multi-light scene management and scalability
- Camera systems and perspective projection
- Interactive UI integration for real-time rendering control
- Clean separation between JavaScript logic and shader code

## Why This Project Matters
This project demonstrates a strong understanding of **real-time lighting**, **shader-based rendering**, and **interactive 3D graphics**, highlighting skills directly applicable to graphics engines, visualization systems, and game development.
