import 'dotenv/config';
import express, { request } from "express";
import { PORT, mongoURL } from "./config.js";
import mongoose from "mongoose";
import { Item } from "./models/itemmodel.js";
import cors from "cors";
import { createRequire } from "module";
const require = createRequire(import.meta.url);//to require require for multer
import { createClient } from '@supabase/supabase-js';
import { Readable } from 'stream';


const app = express();
app.use(express.json());
app.use(cors());
// app.use('/files',express.static("files")) // No longer needed, serving from Supabase

//================================================== Supabase Client ==============================================
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

//================================================== multer ==============================================

const multer = require("multer");

// Custom Multer storage for Supabase
class SupabaseStorage {
  constructor(options) {
    this.supabase = options.supabase;
    this.bucketName = options.bucketName;
  }

  _handleFile(req, file, cb) {
    const uniqueSuffix = Date.now();
    const filename = uniqueSuffix + '-' + file.originalname;

    const uploadStream = this.supabase.storage
      .from(this.bucketName)
      .upload(filename, file.stream, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.mimetype,
      });

    uploadStream
      .then(({ data, error }) => {
        if (error) {
          return cb(error);
        }
        const { data: publicUrlData } = this.supabase.storage
          .from(this.bucketName)
          .getPublicUrl(filename);

        cb(null, {
          path: publicUrlData.publicUrl,
          filename: filename,
        });
      })
      .catch(cb);
  }

  _removeFile(req, file, cb) {
    // Optional: Implement logic to remove file from Supabase if needed
    cb(null);
  }
}

const supabaseStorage = new SupabaseStorage({
  supabase: supabase,
  bucketName: 'item-images', // Your bucket name
});

const upload = multer({ storage: supabaseStorage });


app.get("/", (req, res) => {
  console.log(req);
  return res.status(234).send("Welcome to MERN Stack Tutorial");
});

// ============================== get =================================

app.get("/item", async (req, res) => {
  try {
    const items = await Item.find({});
    return res.status(200).json({
      count: items.length,
      data: items,
    });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// ===============================post===================================

app.post("/item", (req, res) => {
  upload.single("file")(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading.
      console.error("Multer error:", err);
      return res.status(400).send({ message: `Multer error: ${err.message}` });
    } else if (err) {
      // An unknown error occurred when uploading.
      console.error("Unknown upload error:", err);
      return res.status(500).send({ message: `Unknown upload error: ${err.message}` });
    }

    console.log("req.file:", req.file);
    console.log("req.body:", req.body);

    try {
      if (
        !req.body.name ||
        !req.body.email ||
        !req.body.phoneno ||
        !req.body.title ||
        !req.body.description
      ) {
        return res.status(400).send({ message: "All required fields are not sent" });
      }

      const newItem = {
        name: req.body.name,
        email: req.body.email,
        phoneno: req.body.phoneno,
        title: req.body.title,
        description: req.body.description,
      };
      if (req.file) {
        newItem.image = req.file.path; // Save the public URL from Supabase
      }
      const item = await Item.create(newItem);
      return res.status(200).send(item);

    } catch (error) {
      console.error("Database or processing error:", error);
      res.status(500).send({ message: error.message });
    }
  });
});


// =================================-get id ==================================

app.get("/item/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const item = await Item.findById(id);
    return res.status(200).json(item);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
});

// =================================== delete ============================

app.delete("/item/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const result = await Item.findByIdAndDelete(id);
    if (!result) {
      return res.status(404).send({ message: "Item not found" });
    }
    return res.status(200).send({ message: "Item deleted" });
  } catch (error) {
    console.log(error.message);
    return res.status(500).send({ message: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`server started at port ${PORT}`);
});

mongoose
  .connect(mongoURL)
  .then(() => {
    console.log("Connected to database");
  })
  .catch((error) => {
    console.log(error);
  });
