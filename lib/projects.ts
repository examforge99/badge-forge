import { supabase } from "./supabase";
import { CanvasState } from "@/types/canvas";

export interface ProjectSummary {
  id: string;
  name: string;
  updated_at: string;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const { data, error } = await supabase
    .from("badge_projects")
    .select("id, name, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createProject(name: string, state: CanvasState): Promise<string> {
  const { data, error } = await supabase
    .from("badge_projects")
    .insert({ name, data: state })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function loadProject(id: string): Promise<{ name: string; state: CanvasState }> {
  const { data, error } = await supabase
    .from("badge_projects")
    .select("name, data")
    .eq("id", id)
    .single();
  if (error) throw error;
  return { name: data.name, state: data.data as CanvasState };
}

export async function saveProject(id: string, state: CanvasState): Promise<void> {
  const { error } = await supabase
    .from("badge_projects")
    .update({ data: state, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
