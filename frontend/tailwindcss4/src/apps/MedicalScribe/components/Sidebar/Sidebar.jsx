import React, { useState, useMemo, useEffect } from 'react';
import { getAssetPath, formatConsultationDate } from '../../utils/helpers';
import { 
  PencilIcon, CloseIcon, TrashIcon, ChevronDownIcon, ChevronRightIcon,
  MoreVerticalIcon, StarIcon, DownloadIcon, PlusIcon 
} from '../shared/Icons';

export const Sidebar = ({ 
  consultations,
  patients,
  activeConsultationId, 
  onConsultationSelect, 
  onAddConsultationForPatient,
  onAddNewPatient,
  onRenameConsultation,
  onDeleteConsultation,
  onDeletePatient,
  sidebarOpen,
  onCloseSidebar
}) => {
  const [editingConsultationId, setEditingConsultationId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [deletingConsultationId, setDeletingConsultationId] = useState(null);
  const [deletingPatientId, setDeletingPatientId] = useState(null);
  const [expandedPatients, setExpandedPatients] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [openPatientMenu, setOpenPatientMenu] = useState(null);
  const [starredPatients, setStarredPatients] = useState(() => {
    const saved = localStorage.getItem('starredPatients');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  useEffect(() => {
    localStorage.setItem('starredPatients', JSON.stringify([...starredPatients]));
  }, [starredPatients]);

  // Click outside to close menu
  useEffect(() => {
    const handleClickOutside = () => setOpenPatientMenu(null);
    if (openPatientMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openPatientMenu]);

  // Group consultations by patient
  const groupedData = useMemo(() => {
    const result = {
      patients: {},
      orphaned: []
    };
    
    consultations.forEach(consultation => {
      if (consultation.patientId) {
        if (!result.patients[consultation.patientId]) {
          result.patients[consultation.patientId] = {
            id: consultation.patientId,
            name: consultation.patientName || 'Unknown Patient',
            consultations: [],
            mostRecentDate: null
          };
        }
        result.patients[consultation.patientId].consultations.push(consultation);
        
        if (consultation.createdAt) {
          const consultDate = new Date(consultation.createdAt);
          if (!result.patients[consultation.patientId].mostRecentDate || 
              consultDate > result.patients[consultation.patientId].mostRecentDate) {
            result.patients[consultation.patientId].mostRecentDate = consultDate;
          }
        }
      } else {
        result.orphaned.push(consultation);
      }
    });
    
    patients.forEach(patient => {
      if (!result.patients[patient.id]) {
        result.patients[patient.id] = {
          id: patient.id,
          name: patient.name,
          consultations: [],
          mostRecentDate: null
        };
      }
    });
    
    Object.values(result.patients).forEach(patient => {
      patient.consultations.sort((a, b) => {
        if (!a.createdAt && b.createdAt) return -1;
        if (a.createdAt && !b.createdAt) return 1;
        if (!a.createdAt && !b.createdAt) return 0;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    });
    
    return result;
  }, [consultations, patients]);

  // Filter by search
  const filteredGroupedData = useMemo(() => {
    if (!searchQuery.trim()) return groupedData;

    const query = searchQuery.toLowerCase();
    const filtered = {
      patients: {},
      orphaned: groupedData.orphaned.filter(c => 
        c.name.toLowerCase().includes(query)
      )
    };

    Object.entries(groupedData.patients).forEach(([patientId, patient]) => {
      const matchingConsultations = patient.consultations.filter(c =>
        c.name.toLowerCase().includes(query)
      );
      
      if (matchingConsultations.length > 0 || patient.name.toLowerCase().includes(query)) {
        filtered.patients[patientId] = {
          ...patient,
          consultations: matchingConsultations.length > 0 
            ? matchingConsultations 
            : patient.consultations
        };
      }
    });

    return filtered;
  }, [groupedData, searchQuery]);

  const handleRenameConsultation = (id, newName) => {
    onRenameConsultation(id, newName);
    setEditingConsultationId(null);
    setEditingName("");
  };

  const handleEditClick = (e, consultationId, currentName) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingConsultationId(consultationId);
    setEditingName(currentName);
  };

  const handleConsultationClick = (consultationId) => {
    onConsultationSelect(consultationId);
    onCloseSidebar();
  };

  const handleAddNewPatient = () => {
    onAddNewPatient();
    onCloseSidebar();
  };

  const handleDeleteClick = (e, consultationId) => {
    e.preventDefault();
    e.stopPropagation();
    setDeletingConsultationId(consultationId);
  };

  const confirmDelete = () => {
    onDeleteConsultation(deletingConsultationId);
    setDeletingConsultationId(null);
  };

  const cancelDelete = () => {
    setDeletingConsultationId(null);
  };

  const togglePatientExpanded = (patientId) => {
    setExpandedPatients(prev => {
      const next = new Set(prev);
      if (next.has(patientId)) {
        next.delete(patientId);
      } else {
        next.add(patientId);
      }
      return next;
    });
  };

  const handleAddConsultationForPatient = (e, patientId) => {
    e.stopPropagation();
    onAddConsultationForPatient(patientId);
    onCloseSidebar();
  };

  const togglePatientMenu = (e, patientId) => {
    e.stopPropagation();
    setOpenPatientMenu(openPatientMenu === patientId ? null : patientId);
  };

  const handleDeletePatient = (e, patientId) => {
    e.stopPropagation();
    setDeletingPatientId(patientId);
    setOpenPatientMenu(null);
  };

  const confirmDeletePatient = () => {
    onDeletePatient(deletingPatientId);
    setDeletingPatientId(null);
  };

  const toggleStarPatient = (e, patientId) => {
    e.stopPropagation();
    setStarredPatients(prev => {
      const next = new Set(prev);
      if (next.has(patientId)) {
        next.delete(patientId);
      } else {
        next.add(patientId);
      }
      return next;
    });
    setOpenPatientMenu(null);
  };

  const handleExportPatientNotes = async (e, patientId) => {
    e.stopPropagation();
    alert('Export feature coming soon!');
    setOpenPatientMenu(null);
  };

  // Render a single consultation item
  const renderConsultationItem = (consultation) => {
    if (editingConsultationId === consultation.id) {
      return (
        <div key={consultation.id} className="sidebar-consultation-item editing">
          <input
            type="text"
            className="sidebar-rename-input"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={() => handleRenameConsultation(consultation.id, editingName)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRenameConsultation(consultation.id, editingName);
              if (e.key === "Escape") {
                setEditingConsultationId(null);
                setEditingName("");
              }
            }}
            autoFocus
          />
        </div>
      );
    }

    return (
      <div 
        key={consultation.id} 
        className={`sidebar-consultation-item ${
          activeConsultationId === consultation.id ? "active" : ""
        }`}
      >
        <a
          className="sidebar-link"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            handleConsultationClick(consultation.id);
          }}
        >
          <div className="sidebar-link-content">
            <span className="sidebar-link-text">{consultation.name}</span>
            <span className="sidebar-link-date">
              {consultation.createdAt 
                ? formatConsultationDate(consultation.createdAt)
                : 'Not started'}
            </span>
          </div>
        </a>
        
        <div className="sidebar-icons">
          <div 
            className="edit-icon-wrapper"
            onClick={(e) => handleEditClick(e, consultation.id, consultation.name)}
            title="Rename consultation"
          >
            <PencilIcon />
          </div>
          <div 
            className="delete-icon-wrapper"
            onClick={(e) => handleDeleteClick(e, consultation.id)}
            title="Delete consultation"
          >
            <TrashIcon />
          </div>
        </div>
      </div>
    );
  };

  const patientsList = Object.values(filteredGroupedData.patients).sort((a, b) => {
    const aStarred = starredPatients.has(a.id);
    const bStarred = starredPatients.has(b.id);
    if (aStarred && !bStarred) return -1;
    if (!aStarred && bStarred) return 1;
    
    if (a.mostRecentDate && !b.mostRecentDate) return -1;
    if (!a.mostRecentDate && b.mostRecentDate) return 1;
    if (!a.mostRecentDate && !b.mostRecentDate) {
      return a.name.localeCompare(b.name);
    }
    return b.mostRecentDate - a.mostRecentDate;
  });

  const hasPatients = patientsList.length > 0;
  const hasOrphaned = filteredGroupedData.orphaned.length > 0;

  return (
    <>
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`} aria-label="Primary">
        <button className="mobile-sidebar-close" onClick={onCloseSidebar}>
          <CloseIcon />
        </button>
        
        <div className="sidebar-brand">
          <img
            src={getAssetPath("/stethoscribe.png")}
            alt="StethoscribeAI"
            className="sidebar-logo"
          />
        </div>

        <div className="sidebar-search">
          <input
            type="text"
            placeholder="Search patients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sidebar-search-input"
          />
        </div>

        <div className="sidebar-nav-wrapper">
          {patients.length === 0 && consultations.length === 0 ? (
            <div className="sidebar-empty centered">
              <div className="empty-title subtle">No patients yet</div>
              <div className="empty-sub">Add your first patient to get started</div>
            </div>
          ) : (
            <nav className="sidebar-nav">
              {hasPatients && patientsList.map(patient => {
                const isExpanded = expandedPatients.has(patient.id);
                const isStarred = starredPatients.has(patient.id);
                const isMenuOpen = openPatientMenu === patient.id;
                
                return (
                  <div key={patient.id} className="sidebar-section">
                    <div 
                      className="sidebar-section-header sidebar-patient-header"
                      onClick={() => togglePatientExpanded(patient.id)}
                    >
                      <div className="sidebar-patient-info">
                        <div className="sidebar-chevron">
                          {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
                        </div>
                        {isStarred && (
                          <span className="patient-star" title="Starred patient">
                            <StarIcon filled={true} />
                          </span>
                        )}
                        <span className="sidebar-section-title">{patient.name}</span>
                      </div>
                      
                      <div className="sidebar-patient-actions">
                        <span className="sidebar-section-count">{patient.consultations.length}</span>
                        
                        <button
                          className="patient-menu-button"
                          onClick={(e) => togglePatientMenu(e, patient.id)}
                          title="Patient options"
                        >
                          <MoreVerticalIcon />
                        </button>
                        
                        {isMenuOpen && (
                          <div className="patient-menu-dropdown" onClick={(e) => e.stopPropagation()}>
                            <button 
                              className="patient-menu-item"
                              onClick={(e) => toggleStarPatient(e, patient.id)}
                            >
                              <StarIcon filled={isStarred} />
                              <span>{isStarred ? 'Unstar Patient' : 'Star Patient'}</span>
                            </button>
                            
                            <button 
                              className="patient-menu-item"
                              onClick={(e) => handleExportPatientNotes(e, patient.id)}
                            >
                              <DownloadIcon />
                              <span>Export All Notes</span>
                            </button>
                            
                            <div className="patient-menu-divider" />
                            
                            <button 
                              className="patient-menu-item patient-menu-item-danger"
                              onClick={(e) => handleDeletePatient(e, patient.id)}
                            >
                              <TrashIcon />
                              <span>Delete Patient</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="sidebar-section-content">
                        {patient.consultations.map(renderConsultationItem)}
                        <button 
                          className="add-consultation-button-inline"
                          onClick={(e) => handleAddConsultationForPatient(e, patient.id)}
                          title={`New consultation for ${patient.name}`}
                        >
                          <PlusIcon />
                          <span>New consultation</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {hasOrphaned && (
                <div className="sidebar-section">
                  <div 
                    className="sidebar-section-header sidebar-patient-header"
                    onClick={() => togglePatientExpanded('orphaned')}
                  >
                    <div className="sidebar-patient-info">
                      <div className="sidebar-chevron">
                        {expandedPatients.has('orphaned') ? <ChevronDownIcon /> : <ChevronRightIcon />}
                      </div>
                      <span className="sidebar-section-title sidebar-unknown">No Patient</span>
                    </div>
                    <span className="sidebar-section-count">{filteredGroupedData.orphaned.length}</span>
                  </div>
                  
                  {expandedPatients.has('orphaned') && (
                    <div className="sidebar-section-content">
                      {filteredGroupedData.orphaned.map(renderConsultationItem)}
                    </div>
                  )}
                </div>
              )}
            </nav>
          )}
        </div>

        <div className="sidebar-add-patient-footer">
          <button className="add-patient-button-footer" onClick={handleAddNewPatient}>
            <PlusIcon />
            <span>Add New Patient</span>
          </button>
        </div>

        <div className="sidebar-footer">
          <div className="user-block">
            <div className="avatar" aria-hidden="true">
              D
            </div>
            <div className="user-info">
              <div className="user-name">demoUser</div>
              <button className="manage-settings">Placeholder</button>
            </div>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay" onClick={onCloseSidebar} />}

      {deletingConsultationId && (
        <div className="modal-overlay" onClick={cancelDelete}>
          <div className="modal-content delete-confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Delete Consultation</h3>
              <button className="modal-close-button" onClick={cancelDelete} aria-label="Close">
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this consultation?</p>
              <p className="modal-warning-text">This action cannot be undone. All transcript data and notes will be permanently lost.</p>
            </div>
            <div className="modal-footer modal-footer-buttons">
              <button onClick={cancelDelete} className="button button-secondary">
                Cancel
              </button>
              <button onClick={confirmDelete} className="button button-danger">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingPatientId && (
        <div className="modal-overlay" onClick={() => setDeletingPatientId(null)}>
          <div className="modal-content delete-confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Delete Patient</h3>
              <button className="modal-close-button" onClick={() => setDeletingPatientId(null)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this patient and all their consultations?</p>
              <p className="modal-warning-text">
                This will permanently delete all associated data including transcripts and notes. This action cannot be undone.
              </p>
            </div>
            <div className="modal-footer modal-footer-buttons">
              <button onClick={() => setDeletingPatientId(null)} className="button button-secondary">
                Cancel
              </button>
              <button onClick={confirmDeletePatient} className="button button-danger">
                Delete Patient
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};