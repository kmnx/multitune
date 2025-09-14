import dotenv from "dotenv";
import path from "path";

// Load root .env first
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// Load local .env (this will override root settings)
dotenv.config();
