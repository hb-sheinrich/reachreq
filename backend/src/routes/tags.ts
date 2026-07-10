import type { FastifyInstance } from 'fastify';
import { findTagSuggestions } from '../services/tags.js';

export async function tagRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/tags', async (req, reply) => {
    const query = req.query as { search?: string };
    const suggestions = await findTagSuggestions(query.search ?? '', 20);
    return { tags: suggestions };
  });
}
