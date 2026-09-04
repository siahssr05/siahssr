# Builds and runs the whole site as one container: the Express API and the
# plain HTML/CSS/JS frontend it serves directly (backend/server.js's
# express.static block). There's no separate frontend build/deploy — this
# image is the entire site.
FROM node:20-slim
WORKDIR /app

# Copy just the backend's package files first so `npm install` is cached
# separately from the rest of the source — code-only changes then skip
# reinstalling dependencies on rebuild.
COPY backend/package*.json ./backend/
RUN npm install --prefix backend --omit=dev

# Now bring in the actual app: the API (backend/) and the frontend it serves
# (frontend-html/, one directory up from backend/server.js at runtime, which
# is exactly how this layout places it).
COPY backend ./backend
COPY frontend-html ./frontend-html

ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "backend/server.js"]
