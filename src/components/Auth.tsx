import type { ChangeEvent, FormEvent } from "react";
import { useState } from "react";
import { supabase } from "../supabase/client";

export const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    if (isSignUp) {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setMessage(signUpError.message);
        setIsSubmitting(false);
        return;
      }

      setMessage("Account created. Check your inbox if email confirmation is enabled.");
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setMessage(signInError.message);
        setIsSubmitting(false);
        return;
      }
    }

    setIsSubmitting(false);
  };

  return (
    <div className="auth-view">
      <div className="eyebrow">Supabase Tasks</div>
      <h1>{isSignUp ? "Create your workspace" : "Welcome back"}</h1>
      <p className="lede">
        A focused task manager for tracking work, notes, and image-backed
        context in one quiet place.
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setEmail(e.target.value)
            }
            autoComplete="email"
            required
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setPassword(e.target.value)
            }
            autoComplete={isSignUp ? "new-password" : "current-password"}
            minLength={6}
            required
          />
        </label>

        {message ? <p className="status-message">{message}</p> : null}

        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Working..." : isSignUp ? "Sign up" : "Sign in"}
        </button>
      </form>

      <button
        className="text-button"
        type="button"
        onClick={() => {
          setMessage("");
          setIsSignUp((current) => !current);
        }}
      >
        {isSignUp ? "Use an existing account" : "Create a new account"}
      </button>
    </div>
  );
};
