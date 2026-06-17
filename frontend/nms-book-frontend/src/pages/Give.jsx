import { useState } from "react";
import { FaBookOpen, FaImage, FaPlusCircle } from "react-icons/fa";
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

  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setTitle("");
    setSubject("");
    setGrade("");
    setCondition("Good");
    setDescription("");
    setIsSyllabusBook(true);
    setImageFile(null);
    setImagePreview("");
  };

  const selectImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setImageFile(null);
      setImagePreview("");
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Please choose a JPG, PNG, or WEBP image.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("Book image must be 5MB or smaller.");
      event.target.value = "";
      return;
    }

    setMessage("");
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
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

      <form className="form-card" autoComplete="off" onSubmit={postBook}>
        <label className="image-upload-field">
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectImage} />
          <span className="image-preview-frame">
            {imagePreview ? <img src={imagePreview} alt="Selected book cover preview" /> : <FaBookOpen aria-hidden="true" />}
          </span>
          <span>
            <strong><FaImage aria-hidden="true" /> Add book cover</strong>
            <small>JPG, PNG, or WEBP up to 5MB</small>
          </span>
        </label>

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
