const ru = {
  landing: {
    appName: 'Видеозвонок',
    login: 'Войти',
    joinMeeting: 'Присоединиться к звонку',
    heroTitle: 'Безопасные видеозвонки для всех',
    heroSubtitle: 'Простая и надежная платформа для видеоконференций без регистрации и установки',
    startNow: 'Начать сейчас',
    learnMore: 'Узнать больше',
    featuresTitle: 'Наши преимущества',
    feature1Title: 'HD видео и аудио',
    feature1Desc: 'Кристально чистое изображение и звук для комфортного общения',
    feature2Title: 'Текстовый чат',
    feature2Desc: 'Обменивайтесь сообщениями во время звонка',
    feature3Title: 'Безопасность',
    feature3Desc: 'Шифрование данных и защита от несанкционированного доступа',
    feature4Title: 'Кроссплатформенность',
    feature4Desc: 'Работает на всех устройствах без установки',
    ctaTitle: 'Готовы начать?',
    ctaSubtitle: 'Присоединяйтесь к видеозвонку прямо сейчас - это бесплатно и не требует регистрации',
    startFreeCall: 'Начать бесплатный звонок',
    termsOfService: 'Условия использования',
    privacyPolicy: 'Политика конфиденциальности',
    contact: 'Контакты',
    allRightsReserved: 'Все права защищены'
  },
  app: {
    name: 'Видеозвонок',
    desc: 'Защищенные видеозвонки без регистрации',
    backToDashboard: 'Вернуться в дэшборд',
    buttons: {
      cancel: "Отмена",
      join: "Присоединиться",
      joining: "Присоединение..."
    },
    modals: {
      joinVideoCall: {
        title: 'Присоединение к видеозвонку',
        roomCodeOrLink: 'Код комнаты или ссылка',
        enterRoomCodeOrPasteLink: 'Введите код комнаты или вставьте ссылку'
      }
    }
  },
  login: {
    desc: 'Введите пароль для продолжения',
    password: 'Пароль',
    signingIn: 'Входим...',
    signIn: 'Войти',
    enterPassword: 'Введите пароль',
  },
  joinRoom: {
    roomCode: "Код комнаты",
    joinTitle: "Присоединиться к видеозвонку",
    joiningRoom: "Присоединяю к комнате...",
    roomNotFound: 'Комната не найдена',
    joinCall: 'Присоединиться к звонку'
  },
  dashboard: {
    videoCall: 'Видеозвонок',
    recentRooms: 'Недавние комнаты',
    rejoin: 'Переподключиться',
    cards: {
      createLink: {
        title: "Создать ссылку",
        desc: "Начать видеозвонок и поделиться ссылкой"
      },
      joinCall: {
        title: "Присоединиться к звонку",
        desc: "Введите код комнаты или вставьте ссылку"
      }
    }
  },
  admin: {
    common: {
      adminPanel: 'Админ-панель',
      administrator: 'Администратор',
      profile: 'Профиль',
      settings: 'Настройки',
      logout: 'Выйти',
      loading: 'Загрузка...',
      online: 'Онлайн',
      offline: 'Офлайн',
      active: 'Активный',
      inactive: 'Неактивный'
    },
    navigation: {
      dashboard: 'Панель управления',
      rooms: 'Комнаты',
      users: 'Пользователи',
      analytics: 'Аналитика',
      systemSettings: 'Настройки'
    },
    dashboard: {
      welcome: {
        title: 'Добро пожаловать в админ-панель',
        subtitle: 'Управление видеозвонками и мониторинг системы'
      },
      stats: {
        activeRooms: 'Активные комнаты',
        onlineUsers: 'Онлайн пользователи',
        totalCalls: 'Всего звонков',
        serverLoad: 'Серверная нагрузка'
      },
      quickActions: {
        title: 'Быстрые действия',
        roomManagement: {
          title: 'Управление комнатами',
          desc: 'Создание, редактирование и мониторинг'
        },
        userManagement: {
          title: 'Управление пользователями',
          desc: 'Пользователи и права доступа'
        },
        systemSettings: {
          title: 'Системные настройки',
          desc: 'Конфигурация приложения'
        }
      },
      recentActivity: {
        title: 'Недавняя активность',
        roomCreated: 'Создана новая комната',
        userLogin: 'Пользователь вошел в систему',
        roomEnded: 'Завершен звонок в комнате',
        minutesAgo: 'минут назад'
      },
      systemStatus: {
        title: 'Статус системы',
        websocketServer: 'WebSocket сервер',
        sfuServer: 'SFU сервер',
        database: 'База данных'
      }
    },
    header: {
      search: 'Поиск',
      notifications: 'Уведомления',
      language: 'Язык'
    },
    language: {
      selectLanguage: 'Выбрать язык',
      currentLanguage: 'Текущий язык',
      languageChanged: 'Язык успешно изменен'
    },
    videoCall: {
      common: {
        videoCall: 'Видеозвонок',
        room: 'Комната',
        participant: 'Участник',
        participants: 'Участники',
        microphone: 'Микрофон',
        camera: 'Камера',
        screenShare: 'Демонстрация экрана',
        mute: 'Выключить звук',
        unmute: 'Включить звук',
        startVideo: 'Включить видео',
        stopVideo: 'Выключить видео',
        endCall: 'Завершить звонок',
        leaveCall: 'Покинуть звонок',
        joinCall: 'Присоединиться к звонку',
        connection: 'Соединение',
        connecting: 'Подключение...',
        connected: 'Подключен',
        disconnected: 'Отключен',
        poorConnection: 'Плохое соединение',
        goodConnection: 'Хорошее соединение'
      },
      controls: {
        audioSettings: 'Настройки аудио',
        videoSettings: 'Настройки видео',
        fullScreen: 'Полный экран',
        exitFullScreen: 'Выйти из полного экрана',
        chat: 'Чат',
        showChat: 'Показать чат',
        hideChat: 'Скрыть чат',
        raiseHand: 'Поднять руку',
        lowerHand: 'Опустить руку'
      },
      status: {
        waitingForParticipants: 'Ожидание участников',
        callInProgress: 'Звонок в процессе',
        callEnded: 'Звонок завершен',
        youAreMuted: 'Вы на mute',
        youAreUnmuted: 'У вас включен звук',
        videoOn: 'Видео включено',
        videoOff: 'Видео выключено',
        screenSharing: 'Демонстрация экрана',
        participantJoined: 'Участник присоединился',
        participantLeft: 'Участник покинул звонок'
      },
      errors: {
        connectionFailed: 'Не удалось подключиться',
        microphoneAccessDenied: 'Доступ к микрофону запрещен',
        cameraAccessDenied: 'Доступ к камере запрещен',
        roomNotFound: 'Комната не найдена',
        callFailed: 'Звонок не удался',
        // Enhanced WebRTC error messages
        connectionDisconnected: 'Соединение прервано. Попытка переподключения...',
        connectionLost: 'Соединение потеряно. Проверьте подключение к интернету.',
        connectionTimeout: 'Время соединения истекло. Повторная попытка...',
        poorConnection: 'Обнаружено плохое качество соединения. Оптимизация...',
        connectionRestored: 'Соединение восстановлено успешно',
        reconnecting: 'Переподключение к участнику...',
        fallbackToAudioOnly: 'Переключение в аудио-режим для лучшей стабильности',
        fallbackToChatOnly: 'Обнаружены проблемы с соединением. Переключение в режим чата',
        iceConnectionFailed: 'Метод соединения не удался. Попытка альтернативного...',
        peerConnectionError: 'Ошибка соединения. Попытка восстановления...',
        mediaTrackError: 'Ошибка медиа-дорожки. Попытка восстановления...',
        networkChanged: 'Сеть изменена. Настройка соединения...',
        serverUnreachable: 'Сервер недоступен. Повторная попытка соединения...',
        bandwidthLow: 'Обнаружена низкая пропускная способность. Снижение качества...',
        packetLossHigh: 'Обнаружено высокое потери пакетов. Оптимизация соединения...'
      }
    }
  }
};

export default ru;