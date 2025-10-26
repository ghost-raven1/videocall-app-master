const en = {
  landing: {
    appName: 'Video Call',
    login: 'Login',
    joinMeeting: 'Join Meeting',
    heroTitle: 'Secure Video Calls for Everyone',
    heroSubtitle: 'Simple and reliable video conferencing platform with no registration or installation required',
    startNow: 'Start Now',
    learnMore: 'Learn More',
    featuresTitle: 'Our Features',
    feature1Title: 'HD Video & Audio',
    feature1Desc: 'Crystal clear video and audio for comfortable communication',
    feature2Title: 'Text Chat',
    feature2Desc: 'Exchange messages during your call',
    feature3Title: 'Security',
    feature3Desc: 'Data encryption and protection against unauthorized access',
    feature4Title: 'Cross-platform',
    feature4Desc: 'Works on all devices without installation',
    ctaTitle: 'Ready to Start?',
    ctaSubtitle: 'Join a video call right now - it\'s free and requires no registration',
    startFreeCall: 'Start Free Call',
    termsOfService: 'Terms of Service',
    privacyPolicy: 'Privacy Policy',
    contact: 'Contact',
    allRightsReserved: 'All Rights Reserved'
  },
  app: {
    name: 'Video Call',
    desc: 'Secure video calls without registration',
    backToDashboard: 'Back to Dashboard',
    buttons: {
      cancel: "Cancel",
      join: "Join",
      joining: "Joining..."
    },
    modals: {
      joinVideoCall: {
        title: 'Join Video Call',
        roomCodeOrLink: 'Room Code or Link',
        enterRoomCodeOrPasteLink: 'Enter room code or paste link'
      }
    }
  },
  login: {
    desc: 'Enter the access password to continue',
    password: 'Password',
    signingIn: 'Signing in...',
    signIn: 'Sign In',
    enterPassword: 'Enter password',
  },
  joinRoom: {
    roomCode: "Room code",
    joinTitle: "Join Video Call",
    joiningRoom: "Joining room...",
    roomNotFound: 'Room Not Found',
    joinCall: 'Join Call'
  },
  dashboard: {
    videoCall: 'Video Call',
    recentRooms: 'Recent Rooms',
    rejoin: 'Rejoin',
    cards: {
      createLink: {
        title: "Create Link",
        desc: "Start a new video call and share the link"
      },
      joinCall: {
        title: "Join Call",
        desc: "Enter a room code or link to join"
      }
    },
  },
  admin: {
    common: {
      adminPanel: 'Admin Panel',
      administrator: 'Administrator',
      profile: 'Profile',
      settings: 'Settings',
      logout: 'Logout',
      loading: 'Loading...',
      online: 'Online',
      offline: 'Offline',
      active: 'Active',
      inactive: 'Inactive'
    },
    navigation: {
      dashboard: 'Dashboard',
      rooms: 'Rooms',
      users: 'Users',
      analytics: 'Analytics',
      systemSettings: 'Settings'
    },
    dashboard: {
      welcome: {
        title: 'Welcome to Admin Panel',
        subtitle: 'Video call management and system monitoring'
      },
      stats: {
        activeRooms: 'Active Rooms',
        onlineUsers: 'Online Users',
        totalCalls: 'Total Calls',
        serverLoad: 'Server Load'
      },
      quickActions: {
        title: 'Quick Actions',
        roomManagement: {
          title: 'Room Management',
          desc: 'Create, edit and monitor rooms'
        },
        userManagement: {
          title: 'User Management',
          desc: 'Users and access permissions'
        },
        systemSettings: {
          title: 'System Settings',
          desc: 'Application configuration'
        }
      },
      recentActivity: {
        title: 'Recent Activity',
        roomCreated: 'New room created',
        userLogin: 'User logged in',
        roomEnded: 'Call ended in room',
        minutesAgo: 'minutes ago'
      },
      systemStatus: {
        title: 'System Status',
        websocketServer: 'WebSocket Server',
        sfuServer: 'SFU Server',
        database: 'Database'
      }
    },
    header: {
      search: 'Search',
      notifications: 'Notifications',
      language: 'Language'
    },
    language: {
      selectLanguage: 'Select Language',
      currentLanguage: 'Current Language',
      languageChanged: 'Language changed successfully'
    },
    videoCall: {
      common: {
        videoCall: 'Video Call',
        room: 'Room',
        participant: 'Participant',
        participants: 'Participants',
        microphone: 'Microphone',
        camera: 'Camera',
        screenShare: 'Screen Share',
        mute: 'Mute',
        unmute: 'Unmute',
        startVideo: 'Start Video',
        stopVideo: 'Stop Video',
        endCall: 'End Call',
        leaveCall: 'Leave Call',
        joinCall: 'Join Call',
        connection: 'Connection',
        connecting: 'Connecting...',
        connected: 'Connected',
        disconnected: 'Disconnected',
        poorConnection: 'Poor Connection',
        goodConnection: 'Good Connection'
      },
      controls: {
        audioSettings: 'Audio Settings',
        videoSettings: 'Video Settings',
        fullScreen: 'Full Screen',
        exitFullScreen: 'Exit Full Screen',
        chat: 'Chat',
        showChat: 'Show Chat',
        hideChat: 'Hide Chat',
        raiseHand: 'Raise Hand',
        lowerHand: 'Lower Hand'
      },
      status: {
        waitingForParticipants: 'Waiting for participants',
        callInProgress: 'Call in progress',
        callEnded: 'Call ended',
        youAreMuted: 'You are muted',
        youAreUnmuted: 'You are unmuted',
        videoOn: 'Video on',
        videoOff: 'Video off',
        screenSharing: 'Screen sharing',
        participantJoined: 'Participant joined',
        participantLeft: 'Participant left call'
      },
      errors: {
        connectionFailed: 'Connection failed',
        microphoneAccessDenied: 'Microphone access denied',
        cameraAccessDenied: 'Camera access denied',
        roomNotFound: 'Room not found',
        callFailed: 'Call failed',
        // Enhanced WebRTC error messages
        connectionDisconnected: 'Connection disconnected. Attempting to reconnect...',
        connectionLost: 'Connection lost. Please check your internet connection.',
        connectionTimeout: 'Connection timed out. Retrying...',
        poorConnection: 'Poor connection quality detected. Optimizing...',
        connectionRestored: 'Connection restored successfully',
        reconnecting: 'Reconnecting to participant...',
        fallbackToAudioOnly: 'Switching to audio-only mode for better stability',
        fallbackToChatOnly: 'Connection issues detected. Switching to chat-only mode',
        iceConnectionFailed: 'Connection method failed. Trying alternative...',
        peerConnectionError: 'Connection error. Attempting recovery...',
        mediaTrackError: 'Media track error. Attempting to restore...',
        networkChanged: 'Network changed. Adjusting connection...',
        serverUnreachable: 'Server unreachable. Retrying connection...',
        bandwidthLow: 'Low bandwidth detected. Reducing quality...',
        packetLossHigh: 'High packet loss detected. Optimizing connection...'
      }
    }
  }
};

export default en;