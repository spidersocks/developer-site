import React, { useState, useRef, useEffect } from 'react';
import { BACKEND_API_URL } from '../../utils/constants';
import { formatNotesAsHTML, parseHTMLToNotes } from '../../utils/noteFormatters';
import { 
  UndoIcon, RedoIcon, BoldIcon, ItalicIcon, 
  UnderlineIcon, StrikethroughIcon, SaveIcon, CancelIcon, DownloadIcon 
} from '../shared/Icons';
import { NoteTypeConfirmationModal } from '../shared/Modal';
import { LoadingAnimation } from '../shared/LoadingAnimation';

export const NoteEditor = ({ 
  notes, 
  setNotes, 
  loading, 
  error, 
  noteType, 
  onNoteTypeChange, 
  onRegenerate,
  transcriptSegments 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [copied, setCopied] = useState(false);
  const [availableNoteTypes, setAvailableNoteTypes] = useState([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingNoteType, setPendingNoteType] = useState(null);
  const editorRef = useRef(null);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const lastContentRef = useRef("");
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    const fetchNoteTypes = async () => {
      try {
        const resp = await fetch(`${BACKEND_API_URL}/note-types`);
        const data = await resp.json();
        setAvailableNoteTypes(data.note_types || []);
      } catch (err) {
        console.error("Failed to fetch note types:", err);
        setAvailableNoteTypes([
          { id: "standard", name: "Standard Clinical Note" },
          { id: "soap", name: "SOAP Note" },
          { id: "hp", name: "History & Physical (H&P)" },
          { id: "consultation", name: "Consultation Note" },
        ]);
      }
    };
    fetchNoteTypes();
  }, []);

  useEffect(() => {
    if (!isEditing) return;

    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') || 
          ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
        e.preventDefault();
        handleRedo();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isEditing, undoStack, redoStack]);

  const getFullTranscript = () => {
    if (!transcriptSegments || transcriptSegments.size === 0) return "";
    return Array.from(transcriptSegments.values())
      .map(seg => seg.displayText || seg.text || "")
      .join(" ");
  };

  const checkNoteTypeAppropriateness = (newType) => {
    const transcript = getFullTranscript().toLowerCase();
    
    if (newType === "consultation") {
      const consultIndicators = [
        'consult', 'asked to see', 'thank you for asking',
        'referred by dr', 'requested by dr', 'specialist',
        'consultation requested'
      ];
      const hasConsult = consultIndicators.some(ind => transcript.includes(ind));
      
      if (!hasConsult) {
        return {
          appropriate: false,
          warning: "This transcript appears to be a direct patient visit, not a consultation.",
          recommendedType: "standard",
          explanation: "Consultation notes are for specialist evaluations requested by another provider."
        };
      }
    }
    
    if (newType === "hp") {
      const admissionIndicators = ['admitted', 'admission', 'hospital', 'inpatient'];
      const hasAdmission = admissionIndicators.some(ind => transcript.includes(ind));
      
      if (!hasAdmission && transcript.length < 3000) {
        return {
          appropriate: false,
          warning: "H&P notes are typically for hospital admissions or comprehensive evaluations.",
          recommendedType: "standard",
          explanation: "For outpatient visits, consider Standard or SOAP notes."
        };
      }
    }
    
    return { appropriate: true };
  };

  const getNoteTypeWarning = () => {
    if (!notes) return null;
    
    const check = checkNoteTypeAppropriateness(noteType);
    if (!check.appropriate) {
      const recommendedTypeName = availableNoteTypes.find(t => t.id === check.recommendedType)?.name || check.recommendedType;
      return {
        message: `${check.warning} Consider using "${recommendedTypeName}" instead.`,
        severity: "info"
      };
    }
    
    return null;
  };

  const handleEdit = () => {
    const htmlContent = formatNotesAsHTML(notes);
    setEditedContent(htmlContent);
    lastContentRef.current = htmlContent;
    setUndoStack([htmlContent]);
    setRedoStack([]);
    setIsEditing(true);
  };

  const handleSave = () => {
    const parsedNotes = parseHTMLToNotes(editedContent);
    setNotes(parsedNotes);
    setIsEditing(false);
    setUndoStack([]);
    setRedoStack([]);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedContent("");
    setUndoStack([]);
    setRedoStack([]);
  };

  const handleCopy = () => {
    const notesElement = document.querySelector('.notes-display');
    if (!notesElement) return;

    let textContent = '';
    
    // Iterate through all child elements
    notesElement.childNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName === 'DIV') {
          // Each section container
          node.childNodes.forEach((childNode) => {
            if (childNode.nodeType === Node.ELEMENT_NODE) {
              if (childNode.tagName === 'H3') {
                // Section headers with spacing
                textContent += '\n' + childNode.textContent + '\n';
              } else if (childNode.tagName === 'P') {
                // Paragraphs with line break
                textContent += childNode.textContent + '\n';
              } else if (childNode.tagName === 'UL') {
                // Handle lists
                const listItems = childNode.querySelectorAll('li');
                listItems.forEach(li => {
                  textContent += '• ' + li.textContent + '\n';
                });
                textContent += '\n'; // Extra space after list
              } else if (childNode.className === 'nested-section') {
                // Handle nested sections (like ROS)
                childNode.querySelectorAll('p').forEach(p => {
                  textContent += p.textContent + '\n';
                });
                textContent += '\n';
              } else {
                // Other elements
                textContent += childNode.textContent + '\n';
              }
            }
          });
        }
      }
    });

    // Clean up excessive newlines and copy
    textContent = textContent.replace(/\n{3,}/g, '\n\n').trim();
    
    navigator.clipboard.writeText(textContent).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownloadPDF = () => {
    const noteTypeName = availableNoteTypes.find(t => t.id === noteType)?.name || "Clinical Note";
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    const printWindow = window.open('', '', 'height=800,width=800');
    
    let htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${noteTypeName}</title>
        <style>
          @page {
            size: A4;
            margin: 2cm;
          }
          
          body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 12pt;
            line-height: 1.6;
            color: #000;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
          }
          
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #000;
            padding-bottom: 15px;
          }
          
          .header h1 {
            margin: 0 0 10px 0;
            font-size: 18pt;
            font-weight: bold;
          }
          
          .header .date {
            font-size: 11pt;
            color: #333;
          }
          
          h3 {
            font-size: 13pt;
            font-weight: bold;
            margin-top: 20px;
            margin-bottom: 10px;
            border-bottom: 1px solid #ccc;
            padding-bottom: 5px;
            page-break-after: avoid;
          }
          
          h3:first-of-type {
            margin-top: 0;
          }
          
          p {
            margin: 8px 0;
            text-align: justify;
            page-break-inside: avoid;
          }
          
          ul {
            margin: 10px 0;
            padding-left: 25px;
            list-style-type: disc;
          }
          
          li {
            margin: 5px 0;
            page-break-inside: avoid;
          }
          
          strong {
            font-weight: bold;
          }
          
          .section {
            margin-bottom: 15px;
          }
          
          @media print {
            body {
              padding: 0;
            }
            
            .no-print {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${noteTypeName}</h1>
          <div class="date">${currentDate}</div>
        </div>
    `;

    Object.entries(notes).forEach(([section, items]) => {
      if (!items || (Array.isArray(items) && items.length === 0)) return;
      
      htmlContent += `<div class="section"><h3>${section}</h3>`;
      
      if (typeof items === "string") {
        if (items === "None") {
          htmlContent += `<p><em>${items}</em></p>`;
        } else if (section === "Assessment and Plan") {
          items.split("\n").forEach(line => {
            if (line.trim()) htmlContent += `<p>${line.trim()}</p>`;
          });
        } else {
          htmlContent += `<p>${items}</p>`;
        }
      } else if (Array.isArray(items)) {
        htmlContent += "<ul>";
        items.forEach((item) => {
          htmlContent += `<li>${item.text}</li>`;
        });
        htmlContent += "</ul>";
      } else if (typeof items === "object") {
        Object.entries(items).forEach(([key, value]) => {
          htmlContent += `<p><strong>${key}:</strong> ${typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}</p>`;
        });
      }
      
      htmlContent += `</div>`;
    });

    htmlContent += `
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    printWindow.onload = () => {
      printWindow.print();
      printWindow.onafterprint = () => printWindow.close();
    };
  };

  const saveCursorPosition = () => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return null;
    
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(editorRef.current);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    
    return {
      offset: preCaretRange.toString().length,
      container: range.endContainer,
      containerOffset: range.endOffset
    };
  };

  const restoreCursorPosition = (position) => {
    if (!position || !editorRef.current) return;
    
    const selection = window.getSelection();
    const range = document.createRange();
    
    let currentOffset = 0;
    let found = false;
    
    const findNode = (node) => {
      if (found) return;
      
      if (node.nodeType === Node.TEXT_NODE) {
        const nodeLength = node.textContent.length;
        if (currentOffset + nodeLength >= position.offset) {
          range.setStart(node, position.offset - currentOffset);
          range.collapse(true);
          found = true;
          return;
        }
        currentOffset += nodeLength;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        for (let i = 0; i < node.childNodes.length; i++) {
          findNode(node.childNodes[i]);
          if (found) return;
        }
      }
    };
    
    findNode(editorRef.current);
    
    if (found) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
  };

  const handleEditorInput = (e) => {
    if (isUpdatingRef.current) return;
    
    const cursorPos = saveCursorPosition();
    const content = e.currentTarget.innerHTML;
    
    if (content !== lastContentRef.current) {
      setUndoStack(prev => [...prev.slice(-19), lastContentRef.current]);
      setRedoStack([]);
      lastContentRef.current = content;
    }
    
    setEditedContent(content);
    
    requestAnimationFrame(() => {
      restoreCursorPosition(cursorPos);
    });
  };

  const handleUndo = () => {
    if (undoStack.length > 1) {
      isUpdatingRef.current = true;
      
      const newUndoStack = [...undoStack];
      const current = newUndoStack.pop();
      const previous = newUndoStack[newUndoStack.length - 1];
      
      setRedoStack(prev => [...prev, current]);
      setUndoStack(newUndoStack);
      setEditedContent(previous);
      lastContentRef.current = previous;
      
      if (editorRef.current) {
        editorRef.current.innerHTML = previous;
      }
      
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 0);
    }
  };

  const handleRedo = () => {
    if (redoStack.length > 0) {
      isUpdatingRef.current = true;
      
      const newRedoStack = [...redoStack];
      const next = newRedoStack.pop();
      
      setUndoStack(prev => [...prev, next]);
      setRedoStack(newRedoStack);
      setEditedContent(next);
      lastContentRef.current = next;
      
      if (editorRef.current) {
        editorRef.current.innerHTML = next;
      }
      
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 0);
    }
  };

  const applyFormat = (command) => {
    document.execCommand(command, false, null);
    editorRef.current?.focus();
  };

  const handleNoteTypeChangeInternal = (e) => {
    const newType = e.target.value;
    const check = checkNoteTypeAppropriateness(newType);
    
    if (!check.appropriate) {
      setPendingNoteType(newType);
      setShowConfirmModal(true);
    } else {
      proceedWithNoteTypeChange(newType);
    }
  };

  const proceedWithNoteTypeChange = (newType) => {
    onNoteTypeChange(newType);
    onRegenerate(newType);
    setShowConfirmModal(false);
    setPendingNoteType(null);
  };

  const handleConfirmModalCancel = () => {
    const check = checkNoteTypeAppropriateness(pendingNoteType);
    if (check.recommendedType) {
      proceedWithNoteTypeChange(check.recommendedType);
    } else {
      setShowConfirmModal(false);
      setPendingNoteType(null);
    }
  };

  const handleConfirmModalContinue = () => {
    proceedWithNoteTypeChange(pendingNoteType);
  };

  const warning = getNoteTypeWarning();
  const pendingTypeInfo = availableNoteTypes.find(t => t.id === pendingNoteType);
  const check = pendingNoteType ? checkNoteTypeAppropriateness(pendingNoteType) : null;
  const recommendedTypeInfo = check ? availableNoteTypes.find(t => t.id === check.recommendedType) : null;

  if (loading) return <LoadingAnimation message="Generating clinical note..." />;
  if (error) return <div className="error-box">{error}</div>;
  if (!notes)
    return (
      <div className="empty-note">
        <h3>No clinical note yet</h3>
        <p className="empty-note-sub">Complete a recording session to generate a structured clinical note.</p>
      </div>
    );

  if (isEditing) {
    return (
      <>
        <div className="rich-editor-toolbar">
          <div className="toolbar-section">
            <button 
              onClick={handleUndo} 
              className="toolbar-button" 
              disabled={undoStack.length <= 1}
              title="Undo (Ctrl+Z)"
            >
              <UndoIcon />
            </button>
            <button 
              onClick={handleRedo} 
              className="toolbar-button" 
              disabled={redoStack.length === 0}
              title="Redo (Ctrl+Y)"
            >
              <RedoIcon />
            </button>
          </div>
          
          <div className="toolbar-divider" />
          
          <div className="toolbar-section">
            <button 
              onClick={() => applyFormat('bold')} 
              className="toolbar-button"
              title="Bold (Ctrl+B)"
            >
              <BoldIcon />
            </button>
            <button 
              onClick={() => applyFormat('italic')} 
              className="toolbar-button"
              title="Italic (Ctrl+I)"
            >
              <ItalicIcon />
            </button>
            <button 
              onClick={() => applyFormat('underline')} 
              className="toolbar-button"
              title="Underline (Ctrl+U)"
            >
              <UnderlineIcon />
            </button>
            <button 
              onClick={() => applyFormat('strikeThrough')} 
              className="toolbar-button"
              title="Strikethrough"
            >
              <StrikethroughIcon />
            </button>
          </div>

          <div className="toolbar-divider" />

          <div className="toolbar-section toolbar-actions">
            <button onClick={handleCancel} className="toolbar-action-button toolbar-cancel">
              <CancelIcon />
              <span>Cancel</span>
            </button>
            <button onClick={handleSave} className="toolbar-action-button toolbar-save">
              <SaveIcon />
              <span>Save Changes</span>
            </button>
          </div>
        </div>

        <div 
          ref={editorRef}
          className="rich-editor-content"
          contentEditable
          onInput={handleEditorInput}
          suppressContentEditableWarning
          dangerouslySetInnerHTML={{ __html: editedContent }}
        />
      </>
    );
  }

  return (
    <>
      <NoteTypeConfirmationModal
        show={showConfirmModal}
        noteTypeName={pendingTypeInfo?.name}
        warning={check?.warning}
        recommendedType={check?.recommendedType}
        recommendedTypeName={recommendedTypeInfo?.name}
        onConfirm={handleConfirmModalContinue}
        onCancel={handleConfirmModalCancel}
      />
      
      <div className="notes-header-controls">
        <div className="note-type-selector-container">
          <label htmlFor="note-type-select" className="note-type-label">Note Type:</label>
          <select
            id="note-type-select"
            value={noteType}
            onChange={handleNoteTypeChangeInternal}
            className="note-type-selector"
            disabled={loading}
          >
            {availableNoteTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>
        <div className="notes-actions">
          <button onClick={handleEdit} className="icon-button">
            ✎ Edit
          </button>
          <button onClick={handleCopy} className={`icon-button ${copied ? "copied" : ""}`}>
            {copied ? "✓ Copied" : "📋 Copy"}
          </button>
          <button onClick={handleDownloadPDF} className="icon-button">
            <DownloadIcon /> PDF
          </button>
        </div>
      </div>
      
      {warning && (
        <div className={`note-type-hint note-type-hint-${warning.severity}`}>
          <span className="hint-icon">ℹ️</span>
          <span>{warning.message}</span>
        </div>
      )}
      
      <div className="notes-display">
        {Object.entries(notes).map(([section, items]) => {
          if (!items || (Array.isArray(items) && items.length === 0)) return null;
          
          return (
            <div key={section}>
              <h3>{section}</h3>
              {typeof items === "string" ? (
                items === "None" ? (
                  <p className="none-text">{items}</p>
                ) : section === "Assessment and Plan" ? (
                  items.split("\n").map((line, idx) => (line.trim() ? <p key={idx}>{line.trim()}</p> : null))
                ) : (
                  <p>{items}</p>
                )
              ) : Array.isArray(items) ? (
                <ul>
                  {items.map((item, idx) => (
                    <li key={idx}>{item.text}</li>
                  ))}
                </ul>
              ) : typeof items === "object" ? (
                <div className="nested-section">
                  {Object.entries(items).map(([key, value]) => (
                    <p key={key}>
                      <strong>{key}:</strong> {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
};