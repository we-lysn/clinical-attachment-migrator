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
const MIGRATION_SUPABASE_SERVICE_ROLE_KEY =
  process.env.MIGRATION_SUPABASE_SERVICE_ROLE_KEY;
const PROD_SUPABASE_URL = process.env.PROD_SUPABASE_URL;
const PROD_SUPABASE_SERVICE_ROLE_KEY =
  process.env.PROD_SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_NAME = process.env.BUCKET_NAME || "app_private";

const BATCH_SIZE = 10; // Number of attachments to process in each batch

// Validate required environment variables
if (
  !MIGRATION_SUPABASE_URL ||
  !MIGRATION_SUPABASE_SERVICE_ROLE_KEY ||
  !PROD_SUPABASE_URL ||
  !PROD_SUPABASE_SERVICE_ROLE_KEY
) {
  console.error(
    "Missing required environment variables. Please check your .env file."
  );
  process.exit(1);
}
const productionSupabase = createClient(
  PROD_SUPABASE_URL,
  PROD_SUPABASE_SERVICE_ROLE_KEY
);

async function migrate(attachment: { fileKey: string }) {
  // Step 1.1: Ensure the path starts with '/'
  const fileKeyWithSlash = attachment.fileKey.startsWith("/")
    ? attachment.fileKey
    : `/${attachment.fileKey}`;
  const fileKeyWithoutSlash = attachment.fileKey.startsWith("/")
    ? attachment.fileKey.slice(1)
    : attachment.fileKey;
  const fileName = fileKeyWithSlash.split("/").pop();

  // Step 2: check if file exists in the production storage

  const { data: prodData, error: prodError } = await productionSupabase
    .schema("storage")
    .from("objects")
    .select("*")
    .eq("bucket_id", BUCKET_NAME)
    .eq("name", fileKeyWithoutSlash);

  if (prodError) {
    console.error(
      `Error checking file in production storage: ${prodError.message}`
    );

    return prodError; // Return error to handle it in the caller
  }

  if (prodData && prodData.length > 0) {
    console.log(
      `File already exists in production storage: ${fileKeyWithSlash}`
    );
    return null; // File already exists, no need to migrate
  }

  // Step 3: Check if the file exists in the migration storage
  const { data: migrationFile, error: migrationCheckError } =
    await productionSupabase.storage
      .from(BUCKET_NAME)
      .copy(`files/${fileName}`, fileKeyWithoutSlash);

  if (migrationCheckError) {
    console.error(
      `File not found in migration storage: files/${fileName}, trying to search from consent_form folder`
    );

    const { data: migrationFile2, error: migrationCheckError2 } =
      await productionSupabase.storage
        .from(BUCKET_NAME)
        .copy(`consent_forms/${fileName}`, fileKeyWithoutSlash);

    if (migrationCheckError2) {
      console.log(
        `File not found in migration storage: consent_forms/${fileName}, skipping`
      );
    }

    console.log(
      `Successfully copied file to production storage: ${fileKeyWithSlash}`
    );

    return null;
  }

  console.log(
    `Successfully copied file to production storage: ${fileKeyWithSlash}`
  );
}

async function transferClinicalAttachments() {
  try {
    console.log("Starting migration of clinical attachments...");

    // Step 1: Fetch all clinical attachments from the migration database
    const { data: attachments, error: fetchError } = await productionSupabase
      .from("clinical_attachments")
      .select("*");

    if (fetchError) {
      throw new Error(`Error fetching attachments: ${fetchError.message}`);
    }

    console.log(`Found ${attachments.length} attachments to process.`);

    for (let i = 0; i < attachments.length; i += BATCH_SIZE) {
      const batch = attachments.slice(i, i + BATCH_SIZE);
      console.log(
        `Processing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(
          attachments.length / BATCH_SIZE
        )}`
      );
      const migrationPromises = batch.map((attachment) => migrate(attachment));
      await Promise.all(migrationPromises);
    }

    console.log("Migration cycle completed successfully.");
  } catch (error) {
    console.error(
      `Migration failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
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
