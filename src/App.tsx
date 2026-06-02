import type { Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import "./App.css";
import { Auth } from "./components/Auth";
import TaskManager from "./components/TaskManager";
import { supabase } from "./supabase/client";

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (isMounted) {
        setSession(session);
        setIsLoadingSession(false);
      }
    };

    void fetchSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setIsLoadingSession(false);
      },
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <main className="app-shell">
      <section className="app-panel" aria-live="polite">
        {isLoadingSession ? (
          <div className="loading-state">Preparing your workspace...</div>
        ) : session ? (
          <TaskManager session={session} onLogout={logout} />
        ) : (
          <Auth />
        )}
      </section>
    </main>
  );
}

export default App;
