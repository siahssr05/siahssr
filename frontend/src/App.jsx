import { Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import SessionTimeoutBanner from "./components/SessionTimeoutBanner";

import Home from "./pages/Home";
import About from "./pages/About";
import Journals from "./pages/Journals";
import JournalDetail from "./pages/JournalDetail";
import PapersArchive from "./pages/PapersArchive";
import PaperDetail from "./pages/PaperDetail";
import EditorialBoard from "./pages/EditorialBoard";
import Events from "./pages/Events";
import Guidelines from "./pages/Guidelines";
import AuthorProfile from "./pages/AuthorProfile";
import FAQ from "./pages/FAQ";
import Contact from "./pages/Contact";
import LoginChoice from "./pages/LoginChoice";
import AuthorLogin from "./pages/AuthorLogin";
import ReviewerLogin from "./pages/ReviewerLogin";
import AdminLogin from "./pages/AdminLogin";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import SubmitPaper from "./pages/SubmitPaper";
import NotFound from "./pages/NotFound";

import AuthorDashboard from "./pages/dashboard/AuthorDashboard";
import ReviewerDashboard from "./pages/dashboard/ReviewerDashboard";
import AdminDashboard from "./pages/dashboard/AdminDashboard";

export default function App() {
  return (
    <div className="d-flex flex-column min-vh-100">
      <SessionTimeoutBanner />
      <Navbar />
      <main className="flex-grow-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/journals" element={<Journals />} />
          <Route path="/journals/:id" element={<JournalDetail />} />
          <Route path="/papers" element={<PapersArchive />} />
          <Route path="/papers/:id" element={<PaperDetail />} />
          <Route path="/board" element={<EditorialBoard />} />
          <Route path="/events" element={<Events />} />
          <Route path="/guidelines" element={<Guidelines />} />
          <Route path="/authors/:id" element={<AuthorProfile />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/contact" element={<Contact />} />

          <Route path="/login" element={<LoginChoice />} />
          <Route path="/login/author" element={<AuthorLogin />} />
          <Route path="/login/reviewer" element={<ReviewerLogin />} />
          <Route path="/login/admin" element={<AdminLogin />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route
            path="/submit-paper"
            element={
              <ProtectedRoute roles={["author"]}>
                <SubmitPaper />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute roles={["author"]}>
                <AuthorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reviewer"
            element={
              <ProtectedRoute roles={["reviewer"]}>
                <ReviewerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
