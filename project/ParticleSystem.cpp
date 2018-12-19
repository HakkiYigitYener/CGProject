#include "ParticleSystem.h"

void ParticleSystem::kill(int id)
{
	particles.erase(particles.begin() + id);
}
void ParticleSystem::spawn(Particle particle)
{
	particles.push_back(particle);
}
void ParticleSystem::process_particles(float dt)
{
	for (unsigned i = 0; i < particles.size(); ++i) {
		// Kill dead particles!
		if (particles.at(i).lifetime > particles.at(i).life_length)
		{
			kill(i);
		}
	}
	for (unsigned i = 0; i < particles.size(); ++i) {
		// Update alive particles!
		particles.at(i).pos += particles.at(i).velocity * dt;
		particles.at(i).lifetime += dt;

		
	}
}