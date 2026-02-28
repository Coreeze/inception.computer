export type TimeMode = "normal" | "paused";

export interface IDailyChoice {
  action: string;
  place: string;
  reason: string;
  health_impact: number;
  vibe_impact: number;
  wealth_impact: number;
  life_mission_impact: number;
}

export interface IPlannedAction {
  action: string;
  place?: string;
  reason?: string;
  country?: string;
  city?: string;
  longitude?: number;
  latitude?: number;
  place_id?: string;
  participants?: string[];
  is_idle?: boolean;
  health_impact?: number;
  vibe_impact?: number;
  wealth_impact?: number;
}

export interface IBeing {
  _id: string;
  user: string;
  sandbox: string;
  species: string;
  soul_md?: string;
  life_md?: string;
  self_awareness?: "unaware" | "aware";
  first_name?: string;
  last_name?: string;
  gender?: string;
  birth_year?: number;
  birth_month?: number;
  birth_day?: number;
  home_longitude: number;
  home_latitude: number;
  home_city: string;
  home_country: string;
  home_description?: string;
  current_longitude: number;
  current_latitude: number;
  current_city?: string;
  current_country?: string;
  current_place?: string;
  previous_longitude?: number;
  previous_latitude?: number;
  occupation?: string;
  relationship_status?: string;
  romantic_interest?: string;
  life_mission?: { name: string; progress: number };
  current_feeling?: string;
  thought?: string;
  description?: string;
  relationship_to_main_character?: string;
  relationship_index?: number;
  current_action?: string;
  player_action_queue?: IPlannedAction[];
  ai_action_queue?: IPlannedAction[];
  image_url?: string;
  is_dead?: boolean;
  death_reason?: string;
  vibe_index?: number;
  health_index?: number;
  wealth_index?: number;
  monthly_income?: number;
  monthly_expenses?: number;
  is_main?: boolean;
  is_pinned?: boolean;
  is_top_3_npc?: boolean;
  is_episodic?: boolean;
  new?: boolean;
  traits?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MapPlace {
  _id: string;
  name: string;
  type?: string;
  longitude: number;
  latitude: number;
  image_url?: string;
  description?: string;
  city?: string;
  is_home?: boolean;
  is_work?: boolean;
}
