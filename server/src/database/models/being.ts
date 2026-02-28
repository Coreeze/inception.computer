import mongoose from "mongoose";
import { ObjectId } from "mongodb";

const beingsSchema = new mongoose.Schema(
  {
    user: { type: ObjectId, ref: "Users", required: true },
    sandbox: { type: ObjectId, ref: "Sandbox", required: true },
    species: { type: String, required: true },

    soul_md: { type: String, default: "" },
    life_md: { type: String, default: "" },

    achievements: {
      type: [
        {
          name: String,
          description: String,
          positive_or_negative: String,
          day: Number,
          month: Number,
          year: Number,
        },
      ],
      default: [],
    },
    aura_traits: {
      type: [{ name: String, description: String, day: Number, month: Number, year: Number }],
      default: [],
    },
    shadow_traits: {
      type: [{ name: String, description: String, day: Number, month: Number, year: Number }],
      default: [],
    },

    self_awareness: { type: String, enum: ["unaware", "aware"] },

    first_name: { type: String },
    last_name: { type: String },
    gender: { type: String },

    birth_year: { type: Number },
    birth_month: { type: Number },
    birth_day: { type: Number },

    home_longitude: { type: Number, min: -180, max: 180 },
    home_latitude: { type: Number, min: -90, max: 90 },
    home_city: { type: String },
    home_country: { type: String },
    home_description: { type: String },

    current_longitude: { type: Number, min: -180, max: 180 },
    current_latitude: { type: Number, min: -90, max: 90 },
    current_city: { type: String },
    current_country: { type: String },
    current_place: { type: String },

    previous_longitude: { type: Number, min: -180, max: 180 },
    previous_latitude: { type: Number, min: -90, max: 90 },
    previous_city: { type: String },
    previous_country: { type: String },
    previous_place: { type: String },

    occupation: { type: String },
    relationship_status: { type: String },
    romantic_interest: { type: String },

    life_mission: { type: { name: String, progress: Number } },
    quests: {
      type: [
        {
          title: { type: String, required: true },
          description: { type: String },
          status: {
            type: String,
            enum: ["active", "paused", "completed", "quit"],
            default: "active",
          },
          steps: [
            {
              action_text: { type: String },
              reason: { type: String },
              place_name: { type: String },
              completed: { type: Boolean, default: false },
            },
          ],
          started_year: { type: Number },
          started_month: { type: Number },
          started_day: { type: Number },
          completed_year: { type: Number },
          completed_month: { type: Number },
          completed_day: { type: Number },
        },
      ],
      default: [],
    },

    active_heartbeat_id: { type: ObjectId },
    is_processing: { type: Boolean, default: false },

    current_feeling: { type: String },
    thought: { type: String },

    texting_pattern: { type: String },
    description: { type: String },
    relationship_to_main_character: { type: String },
    relationship_index: { type: Number, min: 0, max: 100 },

    chat_count: { type: Number, default: 0 },
    last_contact_at: { type: Date },
    outreach_cooldown_until: { type: Date },

    current_action: { type: String },
    current_action_updated_at: { type: Date },

    player_action_queue: {
      type: [
        {
          action: { type: String },
          place: { type: String },
          reason: { type: String },
          country: { type: String },
          city: { type: String },
          longitude: { type: Number, min: -180, max: 180 },
          latitude: { type: Number, min: -90, max: 90 },
          place_id: { type: ObjectId, ref: "Places" },
          start_year: { type: Number },
          start_month: { type: Number },
          start_day: { type: Number },
          participants: [{ type: ObjectId, ref: "Beings" }],
          is_idle: { type: Boolean },
        },
      ],
      default: [],
    },

    ai_action_queue: {
      type: [
        {
          action: { type: String },
          place: { type: String },
          reason: { type: String },
          country: { type: String },
          city: { type: String },
          longitude: { type: Number, min: -180, max: 180 },
          latitude: { type: Number, min: -90, max: 90 },
          place_id: { type: ObjectId, ref: "Places" },
          start_year: { type: Number },
          start_month: { type: Number },
          start_day: { type: Number },
          participants: [{ type: ObjectId, ref: "Beings" }],
          is_idle: { type: Boolean },
          health_impact: { type: Number },
          vibe_impact: { type: Number },
          wealth_impact: { type: Number },
          action_type: { type: String, enum: ["move", "discover_place", "discover_person", "buy", "event"] },
          discovery_place: {
            name: { type: String },
            description: { type: String },
            latitude: { type: Number },
            longitude: { type: Number },
          },
          discovery_person: {
            first_name: { type: String },
            last_name: { type: String },
            description: { type: String },
            occupation: { type: String },
          },
          purchase: {
            object_type: { type: String },
            name: { type: String },
            price: { type: Number },
            description: { type: String },
          },
          event_participants: [{ type: ObjectId, ref: "Beings" }],
        },
      ],
      default: [],
    },

    reference_body: { type: String },
    default_look: { type: ObjectId, ref: "Looks" },
    image_url: { type: String },

    body_type: { type: String },
    skin_tone: { type: String },
    hair_color: { type: String },
    hair_type: { type: String },
    eye_color: { type: String },
    eye_emotions: { type: String },
    glasses: { type: Boolean },

    death_reason: { type: String },
    is_dead: { type: Boolean, default: false },
    death_year: { type: Number },
    death_month: { type: Number },
    death_day: { type: Number },

    vibe_index: { type: Number, min: 0, max: 100 },
    health_index: { type: Number, min: 0, max: 100 },
    wealth_index: { type: Number },
    monthly_expenses: { type: Number },
    monthly_income: { type: Number },

    engine_version: { type: String },
    user_inputs: { type: Object },
    location: { type: ObjectId, ref: "Location" },

    is_main: { type: Boolean, default: false },
    based_on: { type: ObjectId, ref: "Beings" },
    is_draft: { type: Boolean },
    is_public: { type: Boolean, default: false },
    is_deleted: { type: Boolean, default: false },
    main_character: { type: ObjectId, ref: "Beings" },
    is_pinned: { type: Boolean },
    is_top_3_npc: { type: Boolean, default: false },
    is_episodic: { type: Boolean, default: false },
    new: { type: Boolean, default: true },

    traits: { type: [String], default: [] },

    discovered_places: {
      type: [
        {
          name: { type: String, required: true },
          description: { type: String },
          latitude: { type: Number, min: -90, max: 90 },
          longitude: { type: Number, min: -180, max: 180 },
        },
      ],
      default: [],
    },
    discovered_people: {
      type: [
        {
          first_name: { type: String, required: true },
          last_name: { type: String },
          description: { type: String },
          occupation: { type: String },
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

beingsSchema.index({ main_character: 1 });
beingsSchema.index({ sandbox: 1 });
beingsSchema.index({ user: 1 });
beingsSchema.index({ household: 1 });
beingsSchema.index({ location: 1 });
beingsSchema.index({ "family.children": 1 });
beingsSchema.index({ "family.spouse": 1 });
beingsSchema.index({ "pregnancy.is_pregnant": 1, "pregnancy.due_date": 1 });

export interface IPlannedAction {
  action: string;
  place?: string;
  reason?: string;
  country?: string;
  city?: string;
  longitude?: number;
  latitude?: number;
  start_year?: number;
  start_month?: number;
  start_day?: number;
  place_id?: mongoose.Types.ObjectId | string;
  participants?: (mongoose.Types.ObjectId | string)[];
  is_idle?: boolean;
  health_impact?: number;
  vibe_impact?: number;
  wealth_impact?: number;
  action_type?: "move" | "discover_place" | "discover_person" | "buy" | "event";
  discovery_place?: { name: string; description?: string; latitude?: number; longitude?: number };
  discovery_person?: { first_name: string; last_name?: string; description?: string; occupation?: string };
  purchase?: { object_type: string; name: string; price: number; description?: string };
  event_participants?: (mongoose.Types.ObjectId | string)[];
}

export interface IQuest {
  title: string;
  description?: string;
  status: "active" | "paused" | "completed" | "quit";
  steps: {
    action_text: string;
    reason?: string;
    place_name?: string;
    completed: boolean;
  }[];
  started_year?: number;
  started_month?: number;
  started_day?: number;
  completed_year?: number;
  completed_month?: number;
  completed_day?: number;
}

export interface IBeing extends mongoose.Document {
  user: mongoose.Types.ObjectId | string;
  sandbox: mongoose.Types.ObjectId | string;
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
  home_description: string;
  current_longitude: number;
  current_latitude: number;
  current_city?: string;
  current_country?: string;
  current_place?: string;
  previous_longitude: number;
  previous_latitude: number;
  previous_city?: string;
  previous_country?: string;
  previous_place?: string;
  occupation?: string;
  relationship_status?: string;
  romantic_interest?: string;
  life_mission?: { name: string; progress: number };
  quests?: IQuest[];
  active_heartbeat_id?: mongoose.Types.ObjectId | string;
  is_processing?: boolean;
  current_feeling: string;
  thought: string;
  texting_pattern?: string;
  description?: string;
  relationship_to_main_character?: string;
  relationship_index?: number;
  chat_count?: number;
  last_contact_at?: Date;
  outreach_cooldown_until?: Date;
  current_action?: string;
  current_action_updated_at?: Date;
  player_action_queue?: IPlannedAction[];
  ai_action_queue?: IPlannedAction[];
  reference_body?: string;
  default_look?: mongoose.Types.ObjectId | string;
  image_url?: string;
  body_type?: string;
  skin_tone?: string;
  hair_color?: string;
  hair_type?: string;
  eye_color?: string;
  eye_emotions?: string;
  glasses?: boolean;
  death_reason?: string;
  is_dead?: boolean;
  death_year?: number;
  death_month?: number;
  death_day?: number;
  vibe_index?: number;
  health_index?: number;
  wealth_index?: number;
  monthly_expenses?: number;
  monthly_income?: number;
  is_main?: boolean;
  based_on?: mongoose.Types.ObjectId | string;
  is_draft?: boolean;
  is_public?: boolean;
  is_deleted?: boolean;
  main_character?: mongoose.Types.ObjectId | string;
  is_pinned?: boolean;
  is_top_3_npc?: boolean;
  is_episodic?: boolean;
  new?: boolean;
  traits?: string[];
  discovered_places?: { name: string; description?: string; latitude?: number; longitude?: number }[];
  discovered_people?: { first_name: string; last_name?: string; description?: string; occupation?: string }[];
  createdAt?: Date;
  updatedAt?: Date;
}

export const Being = mongoose.model<IBeing>("Beings", beingsSchema);
