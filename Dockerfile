# ─────────────────────────────────────────────────────────────
#  Production container for the Finance Manager (Next.js)
#  Build:  docker build -t finance \
#            --build-arg NEXT_PUBLIC_SUPABASE_URL=... \
#            --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... .
#  Run:    docker run -p 3000:3000 --env-file .env.local finance
# ─────────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci

# Copy the rest of the source
COPY . .

# NEXT_PUBLIC_* values are baked in at build time, so they must be present now.
# (The secret SUPABASE_SERVICE_ROLE_KEY is NOT needed at build — it's read at runtime.)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NODE_ENV=production

RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start"]
