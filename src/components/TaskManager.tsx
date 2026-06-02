import type { ChangeEvent, FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase/client";

interface Task {
  id: number;
  title: string;
  description: string;
  created_at: string;
  image_url: string | null;
  email: string;
}

interface TaskManagerProps {
  session: Session;
  onLogout: () => Promise<void>;
}

const emptyTaskForm = {
  title: "",
  description: "",
};

function TaskManager({ session, onLogout }: TaskManagerProps) {
  const [newTask, setNewTask] = useState({ title: "", description: "" });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState(emptyTaskForm);
  const [taskImage, setTaskImage] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const completedCount = useMemo(
    () => tasks.filter((task) => task.description.trim().length === 0).length,
    [tasks],
  );

  const deleteTask = async (id: number) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== id));
    setStatusMessage("Task deleted.");
  };

  const updateTask = async (id: number, task: Pick<Task, "title" | "description">) => {
    const { error } = await supabase
      .from("tasks")
      .update(task)
      .eq("id", id);

    if (error) {
      setStatusMessage(error.message);
      return;
    }

    setTasks((currentTasks) =>
      currentTasks.map((currentTask) =>
        currentTask.id === id ? { ...currentTask, ...task } : currentTask,
      ),
    );
    setEditingTaskId(null);
    setEditDraft(emptyTaskForm);
    setStatusMessage("Task updated.");
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const extension = file.name.split(".").pop() ?? "jpg";
    const filePath = `${session.user.id}/${crypto.randomUUID()}.${extension}`;

    const { error } = await supabase.storage
      .from("tasks-images")
      .upload(filePath, file);

    if (error) {
      setStatusMessage(error.message);
      return null;
    }

    const { data } = await supabase.storage
      .from("tasks-images")
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatusMessage("");
    setIsSaving(true);

    let imageUrl: string | null = null;
    if (taskImage) {
      imageUrl = await uploadImage(taskImage);
    }

    const { error, data } = await supabase
      .from("tasks")
      .insert({ ...newTask, email: session.user.email, image_url: imageUrl })
      .select()
      .single();

    if (error) {
      setStatusMessage(error.message);
      setIsSaving(false);
      return;
    }

    if (data) {
      setTasks((currentTasks) => [data, ...currentTasks]);
    }

    setNewTask(emptyTaskForm);
    setTaskImage(null);
    setStatusMessage("Task added.");
    setIsSaving(false);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setTaskImage(e.target.files?.[0] ?? null);
  };

  const startEditing = (task: Task) => {
    setEditingTaskId(task.id);
    setEditDraft({ title: task.title, description: task.description });
  };

  useEffect(() => {
    let isMounted = true;

    supabase
      .from("tasks")
      .select("*")
      .eq("email", session.user.email)
      .order("created_at", { ascending: false })
      .then(({ error, data }) => {
        if (!isMounted) {
          return;
        }

        if (error) {
          setStatusMessage(error.message);
        } else {
          setTasks(data ?? []);
        }

        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [session.user.email]);

  useEffect(() => {
    const channel = supabase
      .channel(`tasks-${session.user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `email=eq.${session.user.email}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const insertedTask = payload.new as Task;
            setTasks((currentTasks) =>
              currentTasks.some((task) => task.id === insertedTask.id)
                ? currentTasks
                : [insertedTask, ...currentTasks],
            );
            return;
          }

          if (payload.eventType === "UPDATE") {
            const updatedTask = payload.new as Task;
            setTasks((currentTasks) =>
              currentTasks.map((task) =>
                task.id === updatedTask.id ? updatedTask : task,
              ),
            );
            return;
          }

          if (payload.eventType === "DELETE") {
            const deletedTask = payload.old as Pick<Task, "id">;
            setTasks((currentTasks) =>
              currentTasks.filter((task) => task.id !== deletedTask.id),
            );
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [session.user.email, session.user.id]);

  return (
    <div className="task-view">
      <header className="task-header">
        <div>
          <div className="eyebrow">Task Manager</div>
          <h1>Build a calmer backlog</h1>
          <p className="lede">
            Signed in as {session.user.email}. Create, edit, and clear tasks
            without losing sight of the work that matters.
          </p>
        </div>
        <button className="secondary-button" type="button" onClick={onLogout}>
          Log out
        </button>
      </header>

      <section className="stats-row" aria-label="Task summary">
        <div>
          <span>{tasks.length}</span>
          <p>Total tasks</p>
        </div>
        <div>
          <span>{completedCount}</span>
          <p>Quick notes</p>
        </div>
      </section>

      <form className="task-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Task title</span>
          <input
            type="text"
            placeholder="Prepare launch checklist"
            value={newTask.title}
            onChange={(e) =>
              setNewTask((prev) => ({ ...prev, title: e.target.value }))
            }
            required
          />
        </label>

        <label className="field">
          <span>Description</span>
          <textarea
            placeholder="Add the next action, context, or blocker."
            value={newTask.description}
            onChange={(e) =>
              setNewTask((prev) => ({ ...prev, description: e.target.value }))
            }
            rows={4}
          />
        </label>

        <div className="form-actions">
          <label className="file-picker">
            <input type="file" accept="image/*" onChange={handleFileChange} />
            <span>{taskImage ? taskImage.name : "Attach image"}</span>
          </label>

          <button className="primary-button" type="submit" disabled={isSaving}>
            {isSaving ? "Adding..." : "Add task"}
          </button>
        </div>
      </form>

      {statusMessage ? <p className="status-message">{statusMessage}</p> : null}

      <section className="task-list" aria-label="Tasks">
        {isLoading ? <p className="empty-state">Loading tasks...</p> : null}

        {!isLoading && tasks.length === 0 ? (
          <p className="empty-state">No tasks yet. Add one to start your list.</p>
        ) : null}

        {tasks.map((task) => {
          const isEditing = editingTaskId === task.id;

          return (
            <article className="task-card" key={task.id}>
              {task.image_url ? (
                <img src={task.image_url} alt="" className="task-image" />
              ) : null}

              {isEditing ? (
                <div className="edit-form">
                  <label className="field">
                    <span>Title</span>
                    <input
                      type="text"
                      value={editDraft.title}
                      onChange={(e) =>
                        setEditDraft((current) => ({
                          ...current,
                          title: e.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Description</span>
                    <textarea
                      value={editDraft.description}
                      onChange={(e) =>
                        setEditDraft((current) => ({
                          ...current,
                          description: e.target.value,
                        }))
                      }
                      rows={3}
                    />
                  </label>
                </div>
              ) : (
                <div className="task-content">
                  <h2>{task.title}</h2>
                  <p>{task.description || "No description added."}</p>
                </div>
              )}

              <footer className="task-card-footer">
                <time dateTime={task.created_at}>
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(task.created_at))}
                </time>
                <div className="task-actions">
                  {isEditing ? (
                    <>
                      <button
                        className="primary-button compact"
                        type="button"
                        onClick={() => updateTask(task.id, editDraft)}
                      >
                        Save
                      </button>
                      <button
                        className="secondary-button compact"
                        type="button"
                        onClick={() => setEditingTaskId(null)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      className="secondary-button compact"
                      type="button"
                      onClick={() => startEditing(task)}
                    >
                      Edit
                    </button>
                  )}
                  <button
                    className="danger-button compact"
                    type="button"
                    onClick={() => deleteTask(task.id)}
                  >
                    Delete
                  </button>
                </div>
              </footer>
            </article>
          );
        })}
      </section>
    </div>
  );
}

export default TaskManager;
