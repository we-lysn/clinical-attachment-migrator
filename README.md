# Clinical Attachment Migrator

A Node.js service that migrates clinical attachments between Supabase storage instances.

## Features

- One-time migration of clinical attachments
- Environment variable configuration for security
- Dockerized for easy deployment
- Comprehensive error handling and logging

## Prerequisites

- Docker and Docker Compose
- Or Node.js 20+ (for local development)

## Configuration

1. **Create a `.env` file** with your Supabase credentials:
   ```env
   # Migration Supabase Configuration
   MIGRATION_SUPABASE_URL=https://your-migration-project.supabase.co
   MIGRATION_SUPABASE_SERVICE_ROLE_KEY=your_migration_service_role_key

   # Production Supabase Configuration
   PROD_SUPABASE_URL=https://your-prod-project.supabase.co
   PROD_SUPABASE_SERVICE_ROLE_KEY=your_prod_service_role_key

   # Storage Configuration
   BUCKET_NAME=app_private
   ```

   > **⚠️ Security Note**: Never commit the `.env` file to version control. Add it to `.gitignore`.

## Quick Start with Docker

1. **Build and run with Docker Compose:**
   ```bash
   docker-compose up
   ```

2. **View logs:**
   ```bash
   docker-compose logs
   ```

## Manual Docker Commands

1. **Build the image:**
   ```bash
   docker build -t clinical-attachment-migrator .
   ```

2. **Run the container:**
   ```bash
   docker run --rm \
     --env-file .env \
     -v $(pwd)/logs:/app/logs \
     clinical-attachment-migrator
   ```

## Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create and configure your `.env` file** (see Configuration section above)

3. **Run in development mode:**
   ```bash
   npm run dev
   ```

4. **Build and run:**
   ```bash
   npm run migrate
   ```

## Available Scripts

- `npm run dev` - Run in development mode with ts-node
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run the compiled JavaScript
- `npm run migrate` - Build and run the migration

## How It Works

The service performs a one-time migration:

1. **Fetch Attachments**: Reads all records from the `clinical_attachments` table in the production database
2. **Check Existence**: Verifies if each file already exists in production storage
3. **Download**: Downloads missing files from the migration storage
4. **Upload**: Uploads files to production storage
5. **Logging**: Comprehensive logging of all operations and errors

## Output

- Console logs show the progress of the migration
- Logs are also saved to the `./logs/` directory when using PM2
- The process exits when the migration is complete

## Error Handling

- Individual file failures don't stop the entire migration
- Detailed error messages for troubleshooting
- Graceful handling of missing files or network issues

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MIGRATION_SUPABASE_URL` | URL of the source Supabase project | Yes |
| `MIGRATION_SUPABASE_SERVICE_ROLE_KEY` | Service role key for source project | Yes |
| `PROD_SUPABASE_URL` | URL of the destination Supabase project | Yes |
| `PROD_SUPABASE_SERVICE_ROLE_KEY` | Service role key for destination project | Yes |
| `BUCKET_NAME` | Storage bucket name (default: app_private) | No |
