﻿talkify = talkify || {};
talkify.config = {
    ui:
    {
        audioControls: {
            enabled: false,
            container: document.body
        }
    },
    remoteService: {
        active: true,
        host: 'https://talkify.net',
        apiKey: '',
        speechBaseUrl: '/api/speech/v1',
        languageBaseUrl: '/api/language/v1'
    }
}