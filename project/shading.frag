#version 420

// required by GLSL spec Sect 4.5.3 (though nvidia does not, amd does)
precision highp float;

///////////////////////////////////////////////////////////////////////////////
// Material
///////////////////////////////////////////////////////////////////////////////
uniform vec3 material_color;
uniform float material_reflectivity;
uniform float material_metalness;
uniform float material_fresnel;
uniform float material_shininess;
uniform float material_emission;

uniform int has_emission_texture;
uniform int has_color_texture;
layout(binding = 0) uniform sampler2D colorMap;
layout(binding = 5) uniform sampler2D emissiveMap;

///////////////////////////////////////////////////////////////////////////////
// Environment
///////////////////////////////////////////////////////////////////////////////
layout(binding = 6) uniform sampler2D environmentMap;
layout(binding = 7) uniform sampler2D irradianceMap;
layout(binding = 8) uniform sampler2D reflectionMap;
uniform float environment_multiplier;

///////////////////////////////////////////////////////////////////////////////
// Light source
///////////////////////////////////////////////////////////////////////////////
uniform vec3 point_light_color = vec3(1.0, 1.0, 1.0);
uniform float point_light_intensity_multiplier = 50.0;

///////////////////////////////////////////////////////////////////////////////
// Constants
///////////////////////////////////////////////////////////////////////////////
#define PI 3.14159265359

///////////////////////////////////////////////////////////////////////////////
// Input varyings from vertex shader
///////////////////////////////////////////////////////////////////////////////
in vec2 texCoord;
in vec3 viewSpaceNormal;
in vec3 viewSpacePosition;

///////////////////////////////////////////////////////////////////////////////
// Input uniform variables
///////////////////////////////////////////////////////////////////////////////
uniform mat4 viewInverse;
uniform vec3 viewSpaceLightPosition;

///////////////////////////////////////////////////////////////////////////////
// Output color
///////////////////////////////////////////////////////////////////////////////
layout(location = 0) out vec4 fragmentColor;

in vec4 shadowMapCoord;
layout(binding = 10) uniform sampler2D shadowMapTex;

uniform vec3 viewSpaceLightDir;
uniform float spotOuterAngle;
uniform float spotInnerAngle;

vec3 calculateDirectIllumiunation(vec3 wo, vec3 n)
{
	///////////////////////////////////////////////////////////////////////////
	// Task 1.2 - Calculate the radiance Li from the light, and the direction
	//            to the light. If the light is backfacing the triangle, 
	//            return vec3(0); 
	///////////////////////////////////////////////////////////////////////////
	vec3 diff = viewSpacePosition - viewSpaceLightPosition;
	float dist = sqrt(pow(diff.x, 2) + pow(diff.y, 2) + pow(diff.z, 2));
	vec3 li = point_light_intensity_multiplier * point_light_color * (1 / pow(dist, 2));
	vec3 wi = normalize(viewSpaceLightPosition - viewSpacePosition);

	if(dot(n, wi) <= 0) {
		return vec3(0);	
	}

	///////////////////////////////////////////////////////////////////////////
	// Task 1.3 - Calculate the diffuse term and return that as the result
	///////////////////////////////////////////////////////////////////////////
	// vec3 diffuse_term = ...

	vec3 diffuse_term = material_color * (1.0/PI) * abs(dot(n, wi)) * li;
	//return diffuse_term;

	///////////////////////////////////////////////////////////////////////////
	// Task 2 - Calculate the Torrance Sparrow BRDF and return the light 
	//          reflected from that instead
	///////////////////////////////////////////////////////////////////////////

	vec3 wh = normalize(wi + wo);
	float s = material_shininess;
	float fresnel = material_fresnel + (1 - material_fresnel) * pow(1 - dot(wh, wi), 5);
	float distribution = (s + 2) / (2 * PI) * pow(dot(n, wh), s);
	float shadowing = min(1, min(2 * dot(n, wh) * dot(n, wo) / dot(wo, wh), 2 * dot(n, wh) * dot(n, wi) / dot(wo, wh)));
	float brdf = (fresnel * distribution * shadowing) / (4 * dot(n, wo) * dot(n, wi));
	
	// return vec3(fresnel);
	// return vec3(shadowing);
	// return brdf * dot(n, wi) * li;

	///////////////////////////////////////////////////////////////////////////
	// Task 3 - Make your shader respect the parameters of our material model.
	///////////////////////////////////////////////////////////////////////////

	float m = material_metalness;
	float r = material_reflectivity;
	vec3 dieletric_term = brdf * dot(n, wi) * li + (1 - fresnel) * diffuse_term;
	vec3 metal_term = brdf * material_color * dot(n, wi) * li;
	vec3 microfacet_term = m * metal_term + (1 - m) * dieletric_term;

	return r * microfacet_term + (1 - r) * diffuse_term;
}

vec3 calculateIndirectIllumination(vec3 wo, vec3 n)
{
	///////////////////////////////////////////////////////////////////////////
	// Task 5 - Lookup the irradiance from the irradiance map and calculate
	//          the diffuse reflection
	///////////////////////////////////////////////////////////////////////////
	vec4 nws = viewInverse * vec4(n.x, n.y, n.z, 0.f);
	float theta = acos(max(-1.0f, min(1.0f, nws.y)));
	float phi = atan(nws.z, nws.x);
	if (phi < 0.0f) phi = phi + 2.0f * PI;

	vec2 lookup = vec2(phi / (2.0 * PI), theta / PI);
	vec4 irradiance = environment_multiplier * texture(irradianceMap, lookup);

	vec3 diffuse_term = material_color * (1.0 / PI) * irradiance.xyz;

	///////////////////////////////////////////////////////////////////////////
	// Task 6 - Look up in the reflection map from the perfect specular 
	//          direction and calculate the dielectric and metal terms. 
	///////////////////////////////////////////////////////////////////////////
	
	vec3 wi = normalize(viewInverse * vec4(reflect(-wo, n), 0.f)).xyz;
	vec3 wh = normalize(wi + wo);

	float fresnel = material_fresnel + (1 - material_fresnel) * pow(1 - dot(wh, wi), 5);
	float roughness = sqrt(sqrt(2/(material_shininess+2)));

	vec3 li = environment_multiplier * textureLod(reflectionMap, lookup, roughness * 7.0).xyz;

	float m = material_metalness;
	float r = material_reflectivity;

	vec3 dieletric_term = fresnel * li + (1 - fresnel) * diffuse_term;
	vec3 metal_term = fresnel * material_color * li;
	vec3 microfacet_term = m * metal_term + (1 - m) * dieletric_term;

	return r * microfacet_term + (1 - r) * diffuse_term;
}


void main() 
{
	float depth = texture(shadowMapTex, shadowMapCoord.xy / shadowMapCoord.w).x;
	float visibility = (depth >= (shadowMapCoord.z / shadowMapCoord.w)) ? 1.0 : 0.0;
	float attenuation = 1.0;

	vec3 posToLight = normalize(viewSpaceLightPosition - viewSpacePosition);
	float cosAngle = dot(posToLight, -viewSpaceLightDir);

	// Spotlight with hard border:
	float spotAttenuation = smoothstep(spotOuterAngle, spotInnerAngle, cosAngle);
	visibility *= spotAttenuation;

	vec3 wo = -normalize(viewSpacePosition);
	vec3 n = normalize(viewSpaceNormal);

	// Direct illumination
	vec3 direct_illumination_term = visibility * calculateDirectIllumiunation(wo, n);

	// Indirect illumination
	vec3 indirect_illumination_term = calculateIndirectIllumination(wo, n);

	///////////////////////////////////////////////////////////////////////////
	// Add emissive term. If emissive texture exists, sample this term.
	///////////////////////////////////////////////////////////////////////////
	vec3 emission_term = material_emission * material_color;
	if (has_emission_texture == 1) {
		emission_term = texture(emissiveMap, texCoord).xyz;
	}

	vec3 shading = 
		direct_illumination_term +
		indirect_illumination_term +
		emission_term;

	fragmentColor = vec4(shading, 1.0);
	return;

}
