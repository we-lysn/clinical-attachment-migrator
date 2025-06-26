/**
 * 1. read from prod db, clinical_attachments table
 * 2. double check prod.select * from storage.objects where bucket_id = 'app_private' and name = attachments.fileKey.replace(/^\//, '');
 * 3. if not exist, download from migration storage, if error, skip
 * 4. if exist, upload to prod storage, if error, skip
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const MIGRATION_SUPABASE_URL = process.env.MIGRATION_SUPABASE_URL;
const MIGRATION_SUPABASE_SERVICE_ROLE_KEY = process.env.MIGRATION_SUPABASE_SERVICE_ROLE_KEY;
const PROD_SUPABASE_URL = process.env.PROD_SUPABASE_URL;
const PROD_SUPABASE_SERVICE_ROLE_KEY = process.env.PROD_SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = process.env.BUCKET_NAME || "app_private";

// Validate required environment variables
if (!MIGRATION_SUPABASE_URL || !MIGRATION_SUPABASE_SERVICE_ROLE_KEY || !PROD_SUPABASE_URL || !PROD_SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing required environment variables. Please check your .env file.");
  process.exit(1);
}

const migrationSupabase = createClient(MIGRATION_SUPABASE_URL, MIGRATION_SUPABASE_SERVICE_ROLE_KEY);
const productionSupabase = createClient(PROD_SUPABASE_URL, PROD_SUPABASE_SERVICE_ROLE_KEY);

async function transferClinicalAttachments() {
  try {
    console.log("Starting migration of clinical attachments...");

    // Step 1: Fetch all clinical attachments from the migration database
    const { data: attachments, error: fetchError } = await productionSupabase.from("clinical_attachments").select("*");

    if (fetchError) {
      throw new Error(`Error fetching attachments: ${fetchError.message}`);
    }

    console.log(`Found ${attachments.length} attachments to process.`);

    for (const attachment of attachments) {
      // Step 1.1: Ensure the path starts with '/'
      const fileKeyWithSlash = attachment.fileKey.startsWith("/") ? attachment.fileKey : `/${attachment.fileKey}`;
      const fileKeyWithoutSlash = attachment.fileKey.startsWith("/") ? attachment.fileKey.slice(1) : attachment.fileKey;
      // Step 2: check if file exists in the production storage

      const { data: prodData, error: prodError } = await productionSupabase
        .schema("storage")
        .from("objects")
        .select("*")
        .eq("bucket_id", BUCKET_NAME)
        .eq("name", fileKeyWithoutSlash);

      if (prodError) {
        console.error(`Error checking file in production storage: ${prodError.message}`);
        continue; // Skip to next attachment
      }

      if (prodData && prodData.length > 0) {
        console.log(`File already exists in production storage: ${fileKeyWithSlash}`);
        continue; // Skip if file already exists
      }

      // Step 3: Check if the file exists in the migration storage
      const { data: migrationFile, error: migrationCheckError } = await migrationSupabase.storage.from(BUCKET_NAME).download(fileKeyWithSlash);

      if (migrationCheckError) {
        console.error(`File not found in migration storage: ${fileKeyWithSlash}`);
        continue; // Skip if file does not exist in migration storage
      }

      // Step 4: Copy the file to production storage
      const { error: copyError } = await productionSupabase.storage.from(BUCKET_NAME).upload(fileKeyWithSlash, migrationFile);

      if (copyError) {
        console.error(`Error copying file to production storage: ${copyError.message}`);
      } else {
        console.log(`Successfully copied file to production storage: ${fileKeyWithSlash}`);
      }
    }

    console.log("Migration cycle completed successfully.");
  } catch (error) {
    console.error(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function runMigrationService() {
  console.log("Clinical Attachment Migrator Service started");
  
  // Run the migration once
  await transferClinicalAttachments();
  
  console.log("Migration completed. Service finished.");
}

// Start the service
runMigrationService().catch(console.error);
