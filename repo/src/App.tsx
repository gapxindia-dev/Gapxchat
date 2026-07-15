import React from 'react';
import { ThemeProvider } from './contexts/ThemeContext.js';
import { SocketProvider, useSocket } from './contexts/SocketContext.js';
import { VoiceProvider } from './contexts/VoiceContext.js';
import { LandingPage } from './pages/LandingPage.js';
import { ChatRoom } from './pages/ChatRoom.js';
import { NotFound } from './pages/NotFound.js';

const MainApp: React.FC = () => {
  const { activeRoom, error } = useSocket();

  // If there's an active room connection, render the chat dashboard
  if (activeRoom) {
    return <ChatRoom />;
  }

  // Handle 404/Connection error
  if (error && error.includes('not found')) {
    return <NotFound onHome={() => window.location.reload()} />;
  }

  // Otherwise, display the room creation/joining landing page
  return <LandingPage />;
};

function App() {
  return (
    <ThemeProvider>
      <SocketProvider>
        <VoiceProvider>
          <MainApp />
        </VoiceProvider>
      </SocketProvider>
    </ThemeProvider>
  );
}

export default App;

