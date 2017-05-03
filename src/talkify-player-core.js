﻿talkify = talkify || {};
talkify.BasePlayer = function (_audiosource, _playbar) {
    this.audioSource = _audiosource;
    this.wordHighlighter = new talkify.wordHighlighter();
    this.id = this.generateGuid();
    var me = this;

    this.settings = {
        useTextHighlight: false,
        referenceLanguage: { Culture: "", Language: -1 },
        lockedLanguage: null,
        rate: 1,
        useControls: false
    };

    this.playbar = _playbar;
    this.forcedVoice = null;

    this.events = {
        onBeforeItemPlaying: function () { },
        onItemLoaded: function () { },
        onSentenceComplete: function () { },
        onPause: function () { },
        onPlay: function () { },
        onResume: function () { },
        onTextHighligtChanged: function () { }
    };

    this.internalEvents = {
        onPause: function () {
            //me.wordHighlighter.pause();
            me.mutateControls(function (c) {
                c.markAsPaused();
            });
            //me.playbar.markAsPaused();

            if (!me.audioSource.ended && me.audioSource.currentTime() > 0) {
                me.events.onPause();
            }
        },
        onPlay: function () {
            //me.wordHighlighter.resume();
            me.mutateControls(function (c) {
                c.markAsPlaying();
            });

            if (me.audioSource.currentTime() > 0) {
                me.events.onResume();
            } else {
                me.events.onPlay();
            }
        },
        onStop: function () {
            me.mutateControls(function (c) {
                c.markAsPaused();
            });
        }
    };

    this.mutateControls = function (mutator) {
        if (this.playbar.instance) {
            mutator(this.playbar.instance);
        }
    }

    if (talkify.config.ui.audioControls.enabled) {
        this.playbar.instance = talkify.playbar().subscribeTo({
            onTextHighlightingClicked: function () {
                me.settings.useTextHighlight = !me.settings.useTextHighlight;
                me.events.onTextHighligtChanged(me.settings.useTextHighlight);
            }
        });
    }
};

talkify.BasePlayer.prototype.withReferenceLanguage = function (refLang) {
    this.settings.referenceLanguage = refLang;

    return this;
};

talkify.BasePlayer.prototype.enableTextHighlighting = function () {
    this.settings.useTextHighlight = true;
    this.mutateControls(function (c) {
        c.setTextHighlight(true);
    });

    return this;
};

talkify.BasePlayer.prototype.disableTextHighlighting = function () {
    this.settings.useTextHighlight = false;
    this.mutateControls(function (c) {
        c.setTextHighlight(false);
    });

    return this;
};

talkify.BasePlayer.prototype.setRate = function (r) {
    this.settings.rate = r;

    return this;
}

talkify.BasePlayer.prototype.subscribeTo = function (subscriptions) {
    this.events.onBeforeItemPlaying = subscriptions.onBeforeItemPlaying || function () { };
    this.events.onSentenceComplete = subscriptions.onItemFinished || function () { };
    this.events.onPause = subscriptions.onPause || function () { };
    this.events.onPlay = subscriptions.onPlay || function () { };
    this.events.onResume = subscriptions.onResume || function () { };
    this.events.onItemLoaded = subscriptions.onItemLoaded || function () { };
    this.events.onTextHighligtChanged = subscriptions.onTextHighligtChanged || function () { };

    return this;
};

talkify.BasePlayer.prototype.generateGuid = function () {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c === "x" ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

talkify.BasePlayer.prototype.playItem = function (item) {
    var p = new promise.Promise();

    if (item && item.isPlaying) {
        if (this.audioSource.paused()) {
            this.audioSource.play();
        } else {
            this.audioSource.pause();
        }

        return p;
    }

    this.events.onBeforeItemPlaying(item);

    var me = this;

    item.isLoading = true;
    item.isPlaying = true;
    item.element.classList.add("playing");

    this.playAudio(item, function () {
        item.isPlaying = false;
        p.done();
    })
        .then(function () {
            item.isLoading = false;
            me.events.onItemLoaded();
        });

    return p;
};

talkify.BasePlayer.prototype.createItems = function (text) {
    var safeMaxQuerystringLength = 1000;

    var items = [];

    //TODO: Smart split, should really split at the first end of sentence (.) that is < safeLength
    if (text.length > safeMaxQuerystringLength) {
        var f = text.substr(0, safeMaxQuerystringLength);

        items.push(template(f));

        items = items.concat(this.createItems(text.substr(safeMaxQuerystringLength, text.length - 1)));

        return items;
    }

    items.push(template(text));

    return items;

    function template(t) {
        //Null-objects
        var element = document.createElement("span");
        var clone = element.cloneNode(true);

        return {
            text: t,
            preview: t.substr(0, 40),
            element: element,
            originalElement: clone,
            isPlaying: false,
            isLoading: false
        };
    }
};

talkify.BasePlayer.prototype.playText = function (text) {
    var items = this.createItems(text);

    var currentItem = 0;

    var next = function () {
        currentItem++;

        if (currentItem >= items.length) {
            return;
        }

        this.playItem(items[currentItem])
            .then(next);
    };

    this.playItem(items[currentItem])
        .then(next);
};

talkify.BasePlayer.prototype.paused = function () {
    return this.audioSource.paused();
};

talkify.BasePlayer.prototype.isPlaying = function () {
    return this.audioSource.isPlaying();
};

talkify.BasePlayer.prototype.play = function () {
    this.audioSource.play();
};

talkify.BasePlayer.prototype.pause = function () {
    this.audioSource.pause();
    var me = this;

    if (!me.audioSource.paused() && me.audioSource.cancel) {
        me.audioSource.cancel(true);
    }
};

talkify.BasePlayer.prototype.dispose = function () {
    this.wordHighlighter.cancel();
    this.audioSource.stop();
    this.internalEvents.onStop();

    this.mutateControls(function (c) {
        c.dispose();
    });

    this.audioSource.dispose();
};

talkify.BasePlayer.prototype.forceLanguage = function (culture) {
    this.settings.lockedLanguage = culture;

    return this;
};

talkify.BasePlayer.prototype.forceVoice = function (voice) {
    this.forcedVoice = voice !== undefined ? voice : null;

    this.settings.lockedLanguage = (voice && (voice.lang || voice.culture)) || this.settings.lockedLanguage;

    this.mutateControls(function (c) {
        c.setVoice(voice);
    });

    return this;
};