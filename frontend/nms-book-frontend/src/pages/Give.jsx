import { useEffect, useRef, useState } from "react";
import { FaCloudUploadAlt, FaImage, FaPlusCircle, FaTimes } from "react-icons/fa";
import API from "../api/api";
import { useUser } from "../context/UserContext";
import { validateBookForm } from "../utils/validation";

function Give() {
  const { demoMode, user } = useUser();

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [condition, setCondition] = useState("Good");
  const [description, setDescription] = useState("");
  const [isSyllabusBook, setIsSyllabusBook] = useState(true);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const clearImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetForm = () => {
    setTitle("");
    setSubject("");
    setGrade("");
    setCondition("Good");
    setDescription("");
    setIsSyllabusBook(true);
    clearImage();
  };

  const setSelectedImage = (file) => {
    if (!file) {
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Please choose a JPG, PNG, or WEBP image.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Book image must be 5MB or smaller.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setMessage("");
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const selectImage = (event) => setSelectedImage(event.target.files?.[0]);

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    setSelectedImage(event.dataTransfer.files?.[0]);
  };

  const postBook = async (event) => {
    event.preventDefault();
    setMessage("");

    if (!user) {
      setMessage("Please login first.");
      return;
    }

    const validationError = validateBookForm({ title, subject, grade, description, isSyllabusBook });
    if (validationError) {
      setMessage(validationError);
      return;
    }

    try {
      setIsSubmitting(true);
      if (demoMode) {
        setMessage("Demo book posted successfully!");
        resetForm();
        return;
      }
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("subject", subject.trim());
      formData.append("grade", grade.trim());
      formData.append("condition", condition);
      formData.append("description", description.trim());
      formData.append("is_syllabus_book", String(isSyllabusBook));
      formData.append("owner_id", String(user.id));
      if (imageFile) formData.append("image", imageFile);

      await API.post("/books", formData);

      setMessage("Book posted successfully!");
      resetForm();
    } catch (err) {
      setMessage(
        err.response?.data?.detail || "Could not post book."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Share a syllabus book</p>
          <h1>Give Book</h1>
        </div>
        <FaPlusCircle aria-hidden="true" />
      </header>

      {message && (
        <p className="page-message">
          {message}
        </p>
      )}

      <form className="form-card give-form" autoComplete="off" onSubmit={postBook}>
        <section className="upload-section" aria-labelledby="book-image-label">
          <div className="field-heading"><span id="book-image-label">Book photo</span><small>Optional, but helps students find it faster</small></div>
          <div
            className={`image-upload-field ${isDragging ? "is-dragging" : ""} ${imagePreview ? "has-image" : ""}`}
            onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input ref={fileInputRef} id="book-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} />
            {imagePreview ? (
              <>
                <span className="image-preview-frame"><img src={imagePreview} alt="Selected book cover preview" /></span>
                <span className="upload-copy"><strong><FaImage aria-hidden="true" /> {imageFile.name}</strong><small>{Math.ceil(imageFile.size / 1024)} KB · ready to upload</small></span>
                <div className="image-actions"><label htmlFor="book-image">Replace</label><button type="button" onClick={clearImage}><FaTimes aria-hidden="true" /> Remove</button></div>
              </>
            ) : (
              <label htmlFor="book-image" className="empty-upload-copy">
                <span className="upload-icon"><FaCloudUploadAlt aria-hidden="true" /></span>
                <strong>Add a real photo of the book</strong>
                <small>Tap to choose a photo, or drag one here on desktop</small>
                <em>JPG, PNG, or WEBP · max 5 MB</em>
              </label>
            )}
          </div>
        </section>

        <input
          type="text"
          name="book-title"
          placeholder="Book Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          required
        />

        <input
          type="text"
          name="book-subject"
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          required
        />

        <input
          type="text"
          name="book-grade"
          placeholder="Grade"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          required
        />

        <select
          name="book-condition"
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
        >
          <option value="Excellent">Excellent</option>
          <option value="Good">Good</option>
          <option value="Used">Used</option>
        </select>

        <textarea
          name="book-description"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          required
        />

        <label className="terms-row">
          <input
            type="checkbox"
            checked={isSyllabusBook}
            onChange={(e) => setIsSyllabusBook(e.target.checked)}
          />

          <span>
            This is an NMS school syllabus book
          </span>
        </label>

        <button
          className="primary-btn"
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Posting..." : "Post Book"}
        </button>
      </form>
    </div>
  );
}

export default Give;
