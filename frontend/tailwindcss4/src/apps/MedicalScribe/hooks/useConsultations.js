import { useState } from 'react';
import { DEFAULT_CONSULTATION } from '../utils/constants';

export const useConsultations = () => {
  const [consultations, setConsultations] = useState([]);
  const [activeConsultationId, setActiveConsultationId] = useState(null);

  const activeConsultation = consultations.find((c) => c.id === activeConsultationId);

  const addNewConsultation = () => {
    const newId = Date.now();
    const newConsultation = {
      id: newId,
      name: `Consultation ${consultations.length + 1}`,
      ...DEFAULT_CONSULTATION,
    };
    setConsultations((prev) => [...prev, newConsultation]);
    setActiveConsultationId(newId);
  };

  const updateConsultation = (id, updates) => {
    setConsultations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const resetConsultation = (id) => {
    updateConsultation(id, {
      transcriptSegments: new Map(),
      interimTranscript: "",
      interimSpeaker: null,
      notes: null,
      error: null,
      sessionState: "idle",
      connectionStatus: "disconnected",
      hasShownHint: false,
    });
  };

  return {
    consultations,
    activeConsultation,
    activeConsultationId,
    setActiveConsultationId,
    addNewConsultation,
    updateConsultation,
    resetConsultation,
    setConsultations,
  };
};