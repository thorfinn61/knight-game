// Ambiance de la salle, appliquée à toute la caméra en une passe :
// palette désaturée, obscurité froide, halos chauds des lumières, vignettage.
#define SHADER_NAME CENDRES_AMBIANCE_FS
#define MAX_LIGHTS 16

precision mediump float;

uniform sampler2D uMainSampler;
uniform vec2 uResolution;
// Par lumière : x, y en pixels (origine en bas à gauche, convention de gl_FragCoord),
// rayon, intensité.
uniform vec4 uLights[MAX_LIGHTS];
uniform vec3 uLightColors[MAX_LIGHTS];
uniform float uLightCount;
uniform vec3 uAmbient;
// Plafond de la lumière cumulée : plusieurs halos superposés ne brûlent pas l'image.
uniform float uMaxLight;
uniform float uSaturation;
uniform float uVignette;
// Nombre de paliers de lumière : chaque halo est découpé puis tramé, façon pixel art.
uniform float uBands;

varying vec2 outTexCoord;

// Matrice de Bayer 4x4 calculée, valeurs dans [0, 1[.
float bayer2(vec2 a) {
  a = floor(a);
  return fract(dot(a, vec2(0.5, a.y * 0.75)));
}

float bayer4(vec2 a) {
  return bayer2(0.5 * a) * 0.25 + bayer2(a);
}

void main() {
  vec4 base = texture2D(uMainSampler, outTexCoord);
  vec2 pixel = floor(gl_FragCoord.xy);
  float dither = bayer4(pixel);

  // On désature avant d'éclairer, pour que les lumières gardent leur teinte chaude.
  float luma = dot(base.rgb, vec3(0.299, 0.587, 0.114));
  vec3 color = mix(vec3(luma), base.rgb, uSaturation);

  vec3 light = uAmbient;
  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (float(i) >= uLightCount) break;
    vec4 source = uLights[i];
    float falloff = clamp(1.0 - distance(pixel + 0.5, source.xy) / source.z, 0.0, 1.0);
    falloff *= falloff;
    float level = floor(falloff * uBands + dither) / uBands;
    light += uLightColors[i] * (level * source.w);
  }

  vec3 lit = color * min(light, vec3(uMaxLight));

  vec2 centered = gl_FragCoord.xy / uResolution - 0.5;
  centered.x *= uResolution.x / uResolution.y;
  lit *= 1.0 - smoothstep(0.3, 0.95, length(centered)) * uVignette;

  gl_FragColor = vec4(lit, base.a);
}
