import React from 'react';

export const PatientInfoPanel = ({
  activeConsultation,
  updateConsultation,
  activeConsultationId,
}) => {
  return (
    <div className="patient-info-tab">
      <h3>Patient Information</h3>
      <div className="patient-info-grid">
        <div className="profile-field">
          <label htmlFor="patient-name">Full Name</label>
          <input
            id="patient-name"
            type="text"
            value={activeConsultation.patientProfile.name}
            onChange={(e) =>
              updateConsultation(activeConsultationId, {
                patientProfile: {
                  ...activeConsultation.patientProfile,
                  name: e.target.value,
                },
              })
            }
            placeholder="Patient's full name"
          />
        </div>
        <div className="profile-field">
          <label htmlFor="patient-dob">Date of Birth</label>
          <input
            id="patient-dob"
            type="date"
            value={activeConsultation.patientProfile.dateOfBirth}
            onChange={(e) =>
              updateConsultation(activeConsultationId, {
                patientProfile: {
                  ...activeConsultation.patientProfile,
                  dateOfBirth: e.target.value,
                },
              })
            }
          />
        </div>
        <div className="profile-field">
          <label htmlFor="patient-sex">Sex</label>
          <select
            id="patient-sex"
            value={activeConsultation.patientProfile.sex}
            onChange={(e) =>
              updateConsultation(activeConsultationId, {
                patientProfile: {
                  ...activeConsultation.patientProfile,
                  sex: e.target.value,
                },
              })
            }
          >
            <option value="">Select</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="profile-field">
          <label htmlFor="patient-mrn">HKID Number</label>
          <input
            id="patient-mrn"
            type="text"
            value={activeConsultation.patientProfile.medicalRecordNumber}
            onChange={(e) =>
              updateConsultation(activeConsultationId, {
                patientProfile: {
                  ...activeConsultation.patientProfile,
                  medicalRecordNumber: e.target.value,
                },
              })
            }
            placeholder="HKID"
          />
        </div>
        <div className="profile-field">
          <label htmlFor="patient-email">Email</label>
          <input
            id="patient-email"
            type="email"
            value={activeConsultation.patientProfile.email}
            onChange={(e) =>
              updateConsultation(activeConsultationId, {
                patientProfile: {
                  ...activeConsultation.patientProfile,
                  email: e.target.value,
                },
              })
            }
            placeholder="patient@example.com"
          />
        </div>
        <div className="profile-field">
          <label htmlFor="patient-phone">Phone Number</label>
          <input
            id="patient-phone"
            type="tel"
            value={activeConsultation.patientProfile.phoneNumber}
            onChange={(e) =>
              updateConsultation(activeConsultationId, {
                patientProfile: {
                  ...activeConsultation.patientProfile,
                  phoneNumber: e.target.value,
                },
              })
            }
            placeholder="+852 XXXX XXXX"
          />
        </div>
        <div className="profile-field full-width">
          <label htmlFor="referring-physician">Referring Physician</label>
          <input
            id="referring-physician"
            type="text"
            value={activeConsultation.patientProfile.referringPhysician}
            onChange={(e) =>
              updateConsultation(activeConsultationId, {
                patientProfile: {
                  ...activeConsultation.patientProfile,
                  referringPhysician: e.target.value,
                },
              })
            }
            placeholder="Dr. Name"
          />
        </div>
        <div className="profile-field full-width">
          <label htmlFor="additional-context">Additional Context</label>
          <textarea
            id="additional-context"
            value={activeConsultation.additionalContext}
            onChange={(e) =>
              updateConsultation(activeConsultationId, {
                additionalContext: e.target.value,
              })
            }
            placeholder="Paste any relevant patient history, medications, allergies, chronic conditions, or context here..."
            rows={4}
          />
        </div>
      </div>
    </div>
  );
};