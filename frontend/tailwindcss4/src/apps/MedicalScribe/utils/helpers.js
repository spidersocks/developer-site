export const getAssetPath = (path) => {
  const baseUrl = import.meta.env.BASE_URL || "/";
  return `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
};

export const getFriendlySpeakerLabel = (speakerId, speakerRoles) => {
  if (!speakerId) return "...";
  if (speakerRoles[speakerId]) return speakerRoles[speakerId];
  const speakerNum = parseInt(String(speakerId).replace("spk_", ""), 10);
  return !isNaN(speakerNum) ? `Speaker ${speakerNum + 1}` : speakerId;
};

export const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return "";
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age.toString();
};

export const hasPatientProfileContent = (profile) => {
  return !!(
    profile.name ||
    profile.dateOfBirth ||
    profile.sex ||
    profile.medicalRecordNumber ||
    profile.referringPhysician ||
    profile.email ||
    profile.phoneNumber
  );
};

export const generatePatientName = (profile) => {
  if (!profile.name) return null;
  
  let newName = profile.name;
  const details = [];
  const age = calculateAge(profile.dateOfBirth);
  if (age) details.push(age);
  if (profile.sex) details.push(profile.sex.charAt(0));
  
  if (details.length > 0) {
    newName += ` (${details.join('')})`;
  }
  
  return newName;
};

export const to16BitPCM = (input) => {
  const buffer = new ArrayBuffer(input.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
};