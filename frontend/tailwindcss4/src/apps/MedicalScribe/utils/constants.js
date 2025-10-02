export const BACKEND_WS_URL =
  import.meta.env.VITE_BACKEND_WS_URL || "ws://localhost:8000/client-transcribe";
export const BACKEND_API_URL =
  import.meta.env.VITE_BACKEND_API_URL || "http://localhost:8000";

export const DEFAULT_NOTE_TYPES = [
  { id: "standard", name: "Standard Clinical Note" },
  { id: "soap", name: "SOAP Note" },
  { id: "hp", name: "History & Physical (H&P)" },
  { id: "consultation", name: "Consultation Note" },
];

export const DEFAULT_CONSULTATION = {
  sessionState: "idle",
  connectionStatus: "disconnected",
  transcriptSegments: new Map(),
  interimTranscript: "",
  interimSpeaker: null,
  notes: null,
  loading: false,
  error: null,
  language: "en-US",
  speakerRoles: {},
  activeTab: "transcript",
  hasShownHint: false,
  patientProfile: {
    name: "",
    dateOfBirth: "",
    sex: "",
    medicalRecordNumber: "",
    referringPhysician: "",
    email: "",
    phoneNumber: "",
  },
  additionalContext: "",
  customNameSet: false,
  noteType: "standard",
};