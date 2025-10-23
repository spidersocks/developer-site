import React from "react";

function LittleScholarsBotDemo() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 sm:p-8">
      <div className="max-w-xs md:max-w-md bg-red-100 border border-red-400 text-red-700 p-6 rounded-lg shadow-md text-center">
        <h1 className="text-xl font-bold mb-2">Service Temporarily Unavailable</h1>
        <p>We are currently performing maintenance on this system.</p>
        <p>Returning to normal operation shortly.</p>
        <p>Thank you for your patience.</p>
      </div>
    </div>
  );
}

export default LittleScholarsBotDemo;

// import React, { useState } from "react";

// // The base URL for your FastAPI backend
// const API_BASE_URL = "https://unified-backend.fly.dev";

// // Define hex codes for colors to ensure consistency
// const ACTIVE_BG_COLOR = "#1d4ed8"; // Tailwind blue-700
// const DISABLED_BG_COLOR = "#3b82f6"; // Tailwind blue-500
// const TEXT_COLOR = "#ffffff"; // White

// function LittleScholarsBotDemo() {
//   const [inputMessage, setInputMessage] = useState("");
//   const [response, setResponse] = useState(null);
//   const [isLoading, setIsLoading] = useState(false);
//   const [error, setError] = useState(null);
//   // State to store the last successful user message for display
//   const [lastUserMessage, setLastUserMessage] = useState(null);

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     const message = inputMessage.trim();
//     if (!message) return;

//     setIsLoading(true);
//     setResponse(null);
//     setError(null);
//     setLastUserMessage(message); // Save the message before clearing input

//     try {
//       const payload = {
//         message: message,
//         // language omitted – server will auto-detect
//       };

//       const res = await fetch(`${API_BASE_URL}/chat`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(payload),
//       });

//       if (!res.ok) {
//         throw new Error(`HTTP error! Status: ${res.status}`);
//       }

//       const data = await res.json();
      
//       // IMPORTANT: If the backend returns an empty answer (due to strict instructions), 
//       // we should not display a bot bubble, but we should clear the user message 
//       // if the bot successfully processed the request (i.e., didn't error).
//       if (data.answer && data.answer.trim() !== "") {
//         setResponse(data);
//       } else {
//         // If the answer is empty, clear the response state but keep the user message displayed
//         setResponse(null); 
//       }

//       setInputMessage("");
//     } catch (err) {
//       console.error("API Error:", err);
//       setError("Failed to connect to the backend or process the request.");
//       setLastUserMessage(null); // Clear user message on failure
//     } finally {
//       // This ensures isLoading is set to false, making "The bot is typing..." disappear,
//       // whether a response was received or not (including silent responses).
//       setIsLoading(false); 
//     }
//   };

//   const isDisabled = isLoading || !inputMessage.trim();

//   return (
//     <div className="min-h-screen bg-gray-100 p-4 sm:p-8">
//       <div className="max-w-3xl mx-auto bg-white shadow-xl rounded-xl p-6 md:p-10">
        
//         {/* Header Section */}
//         <div className="text-center mb-8">
//             <h1 className="text-3xl font-bold text-gray-800 mb-2">
//               Little Scholars KB Chat Demo
//             </h1>
//             <p className="text-gray-600">
//               Ask questions about the content indexed in the Bedrock Knowledge Base.
//             </p>
//         </div>

//         {/* Chat History/Display Area */}
//         <div className="h-96 overflow-y-auto p-4 space-y-4 bg-gray-50 border border-gray-200 rounded-lg mb-8">
            
//             {/* Initial Bot Message (REMOVED) */}

//             {/* Display Last User Message */}
//             {lastUserMessage && (
//                 <div className="flex justify-end">
//                     <div className="max-w-xs md:max-w-md p-3 rounded-xl rounded-br-none bg-blue-500 text-white shadow-md">
//                         {lastUserMessage}
//                     </div>
//                 </div>
//             )}

//             {/* Display Bot Response */}
//             {response && (
//                 <div className="flex justify-start">
//                     <div className="max-w-xs md:max-w-md p-3 rounded-xl rounded-tl-none bg-green-100 text-gray-800 shadow-md whitespace-pre-wrap">
//                         {response.answer}
//                     </div>
//                 </div>
//             )}

//             {/* Display Loading/Error */}
//             {isLoading && (
//                 <div className="flex justify-start">
//                     <div className="max-w-xs md:max-w-md p-3 rounded-xl rounded-tl-none bg-gray-200 text-gray-600 italic">
//                         The bot is typing...
//                     </div>
//                 </div>
//             )}

//             {error && (
//                 <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
//                     Error: {error}
//                 </div>
//             )}
//         </div>
        
//         {/* Input Form */}
//         <form onSubmit={handleSubmit}>
//           <div className="flex flex-col sm:flex-row gap-4">
//             <input
//               type="text"
//               value={inputMessage}
//               onChange={(e) => setInputMessage(e.target.value)}
//               placeholder="E.g., 學費幾多？/ What's the tuition?"
//               className="flex-grow p-3 border border-gray-300 rounded-full focus:ring-blue-500 focus:border-blue-500"
//               disabled={isLoading}
//             />
//             <button
//               type="submit"
//               style={{
//                 backgroundColor: isDisabled ? DISABLED_BG_COLOR : ACTIVE_BG_COLOR,
//                 color: TEXT_COLOR,
//               }}
//               className={`px-6 py-3 rounded-full font-semibold transition duration-150 ${
//                 isDisabled ? "cursor-not-allowed opacity-75" : "hover:bg-blue-800"
//               }`}
//               disabled={isDisabled}
//             >
//               {isLoading ? "Thinking..." : "Send"}
//             </button>
//           </div>
//         </form>
//       </div>
//     </div>
//   );
// }

// export default LittleScholarsBotDemo;