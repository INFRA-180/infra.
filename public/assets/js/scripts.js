window.INFRA_BUILD_TAG = "audiofix301-20260711";

try {
    document.documentElement.dataset.build = window.INFRA_BUILD_TAG, document.documentElement.setAttribute("data-build", window.INFRA_BUILD_TAG),
    window.INFRA_BUILD_LOGGED || (window.INFRA_BUILD_LOGGED = !0, console.info("[INFRA] build", window.INFRA_BUILD_TAG));
} catch (_err) {}

const infraDownloadsApi = window.InfraDownloads || {};

function normalizeDownloadUrl(rawUrl) {
    return "function" == typeof infraDownloadsApi.normalizeDownloadUrl ? infraDownloadsApi.normalizeDownloadUrl(rawUrl) : String(rawUrl || "").replace(/&amp;/g, "&").trim();
}

function downloadNow(url) {
    "function" == typeof infraDownloadsApi.downloadNow && infraDownloadsApi.downloadNow(url);
}

function openAppDownloadGatekeeper(appName, url) {
    "function" == typeof infraDownloadsApi.openAppDownloadGatekeeper ? infraDownloadsApi.openAppDownloadGatekeeper(appName, url) : downloadNow(url);
}

!function() {
    const spaRouterApi = window.InfraSpaRouter || null, spaRouterConstants = spaRouterApi && spaRouterApi.constants ? spaRouterApi.constants : {}, spaState = {
        enabled: spaRouterApi && "function" == typeof spaRouterApi.isEnabled ? spaRouterApi.isEnabled(window.location) : "http:" === window.location.protocol || "https:" === window.location.protocol,
        bound: !1,
        controller: null,
        currentUrl: window.location.href,
        scrollSaveRaf: 0,
        scrollBound: !1,
        pageCache: new Map,
        pageCacheOrder: [],
        pageCacheLimit: Number.isFinite(Number(spaRouterConstants.PAGE_CACHE_LIMIT)) ? Number(spaRouterConstants.PAGE_CACHE_LIMIT) : 30,
        prefetchingPages: new Set,
        lastNavHref: "",
        lastNavTs: 0,
        navToken: 0,
        navigationActive: !1,
        albumCoverPlaceholderByUrl: new Map,
        pwaCoverHold: null,
        liveHomeRoute: null,
        pageCacheApi: null
    }, audioState = {
        audio: null,
        playlist: [],
        playlistKind: "album",
        currentIndex: -1,
        shuffleOn: !1,
        suiteOn: !0,
        homeMode: "album",
        homeModeInitialized: !1,
        homeModeStorageKey: "infra_home_play_mode_v2",
        radioPlaylist: [],
        radioQueue: [],
        radioQueueCursor: -1,
        radioQueueBatchSize: 24,
        radioQueueMinRemaining: 5,
        radioQueueExtendBy: 10,
        radioLoadingPromise: null,
        radioNavigationPromise: null,
        tracksData: null,
        tracksLoadingPromise: null,
        albumPlaylistSnapshot: [],
        albumIndexSnapshot: -1,
        ui: null,
        transport: null,
        raf: null,
        fadeTimer: null,
        fadeResolve: null,
        prefetchLinks: new Map,
        prefetchOrder: [],
        maxPrefetchLinks: isIosDevice() ? 8 : 12,
        proactivePrefetching: new Set,
        prefetchPausedUntil: 0,
        restored: !1,
        pendingSeekRatio: null,
        pendingStartTime: null,
        keyboardBound: !1,
        resumeBound: !1,
        resumeStorageKey: "infra_audio_resume_v1",
        queueStorageKey: "infra_playback_queue_v1",
        transportResizeBound: !1,
        mediaSessionBound: !1,
        lastMediaSessionKey: "",
        mediaSessionAudioPlaying: !1,
        waitingRecoveryTimer: null,
        mediaSessionResyncTimer: null,
        mediaSessionPositionTs: 0,
        audioSessionTelemetryBound: !1,
        externalPlaybackCommandSeq: 0,
        externalPlaybackCommand: null,
        externalResumeProbeTimers: [],
        externalResumeRecoveryInFlight: !1,
        activeAudioRecovery: null,
        resumeOnVisible: !1,
        recentPlayed: [],
        recentPlayedLimit: 12,
        playlistToken: "",
        lastResumeSaveTs: 0,
        overlayEscapeBound: !1,
        nowPlayingOpen: !1,
        nowPlayingQueueOpen: !1,
        nowPlayingScrollY: 0,
        nowPlayingSeeking: !1,
        nowPlayingVolumeSeeking: !1,
        nowPlayingClosing: !1,
        nowPlayingPreviousThemeColor: "",
        nowPlayingThemeArtwork: "",
        nowPlayingThemeToken: 0,
        nowPlayingMiniRect: null,
        nowPlayingVolumeVisible: !1,
        nowPlayingVolumeStorageKey: "infra_now_playing_volume_visible_v1",
        desktopTransportState: null,
        trackFailureCounts: new Map,
        trackDurationData: null,
        trackDurationLoadingPromise: null,
        trackMetaByAssetPath: new Map,
        lastAutoSkipTs: 0,
        lastAutoAdvanceTs: 0,
        startRequestToken: 0,
        trackStartInFlight: !1,
        activeMediaRequest: null,
        lastTrackChangeTs: 0,
        activeLogicalSrc: "",
        activeBlobUrl: "",
        trackDurationCache: new Map,
        activeStatusTrack: null,
        coverUpdateToken: 0,
        playRequestTs: 0,
        playRequestToken: 0,
        lastMonitorPlayToken: 0,
        lastAudioCurrentTime: 0,
        loggedCacheHitSrc: "",
        audioClickPerfTs: 0,
        currentTrackPath: "",
        initialRandomPlaylist: [],
        initialRandomFirstSrc: "",
        initialRandomReady: !1,
        initialRandomPreparing: !1,
        initialRandomPreparePromise: null,
        initialRandomPrepareToken: 0,
        nextPrefetchInFlight: !1,
        nextPrefetchSrc: "",
        nextPrefetchIndex: -1,
        nextPrefetchFromIndex: -1,
        nextPrefetchToken: 0,
        nextPrefetchDoneSrc: "",
        nextPrefetchServedSrc: "",
        nextPrefetchAttemptedSrc: "",
        nextPrefetchFailedSrc: "",
        nextPrefetchFailureReason: "",
        spaSwitchContext: null,
        favoriteEntries: [],
        favoritePaths: new Set,
        favoritesLoaded: !1,
        favoritesLoadingPromise: null,
        favoritesDbSupported: !0,
        favoritesStartInFlight: !1,
        favoritesRouteBound: !1,
        favoritesViewRendering: !1,
        favoritesDragState: null,
        favoritesRenderStartTs: 0,
        favoritesSelectionMode: !1,
        favoritesSelectedPaths: new Set,
        favoritesPreloadScheduled: !1,
        favoritesPreloadDone: !1,
        favoritesResetPromise: null,
        favoritesResetApplied: !1,
        favoritePendingPaths: new Set,
        homeFavoritesDelegatedBound: !1,
        albumCoverCacheWarmupScheduled: !1,
        albumCoverCacheWarmupDone: !1,
        albumCoverPreparePromise: null,
        albumCoverReadyUrls: new Set,
        albumCoverImageCache: new Map,
        albumCoverPrimeUrls: new Set,
        coverTelemetryRecent: new Map
    }, pwaState = {
        choiceStorageKey: "infra_pwa_install_choice_v1",
        sessionDismissed: !1
    }, pwaInstallApi = function() {
        const module = window.InfraPwaInstall && "object" == typeof window.InfraPwaInstall ? window.InfraPwaInstall : null, factory = module && "function" == typeof module.createPwaInstall ? module.createPwaInstall : null;
        return factory ? factory({
            pwaState: pwaState,
            isIosDevice: isIosDevice,
            isAndroidDevice: isAndroidDevice,
            isStandaloneDisplayMode: isStandaloneDisplayMode
        }) : {};
    }(), HEART_ICON_OUTLINE = '<svg class="heart-icon heart-icon-outline" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.9" d="M19.5 12.572 12 20l-7.5-7.428A5 5 0 1 1 12 6.006a5 5 0 1 1 7.5 6.566Z"/></svg>', AUDIO_BASE = "https://pub-e477c478bcb148fc93749cc86b3d39fa.r2.dev", prefetchApi = window.InfraAudioPrefetch || null, prefetchConstants = prefetchApi && prefetchApi.constants ? prefetchApi.constants : {}, PREFETCH_NEXT_ENABLED = !Object.prototype.hasOwnProperty.call(prefetchConstants, "ENABLED") || Boolean(prefetchConstants.ENABLED), PREFETCH_NEXT_CACHE_NAME = prefetchConstants.CACHE_NAME || "infra-next-track", coverApi = window.InfraCovers || null, coverConstants = coverApi && coverApi.constants ? coverApi.constants : {}, COVERS_CACHE_NAME = coverConstants.CACHE_NAME || "infra-covers", COVER_SESSION_PREPARE_ENABLED = !Object.prototype.hasOwnProperty.call(coverConstants, "SESSION_PREPARE_ENABLED") || Boolean(coverConstants.SESSION_PREPARE_ENABLED), COVER_SESSION_PREPARE_CONCURRENCY = Number.isFinite(Number(coverConstants.SESSION_PREPARE_CONCURRENCY)) ? Math.max(1, Number(coverConstants.SESSION_PREPARE_CONCURRENCY)) : 3, COVER_SESSION_NAVIGATION_GATE_ENABLED = !Object.prototype.hasOwnProperty.call(coverConstants, "SESSION_NAVIGATION_GATE_ENABLED") || Boolean(coverConstants.SESSION_NAVIGATION_GATE_ENABLED), ALBUM_COVER_IMAGE_CACHE_LIMIT = isStandaloneDisplayMode() ? 12 : 24, PREFETCH_NEXT_MAX_BYTES = Number.isFinite(Number(prefetchConstants.MAX_BYTES)) ? Number(prefetchConstants.MAX_BYTES) : 15728640, PREFETCH_NEXT_THRESHOLD_SECONDS = Number.isFinite(Number(prefetchConstants.THRESHOLD_SECONDS)) ? Number(prefetchConstants.THRESHOLD_SECONDS) : 30, WORKER_URL = "https://infra180-audio.zaccary-caillol.workers.dev", audioTelemetryModule = window.InfraAudioTelemetry || null;
    function getAudioTelemetryNow() {
        return audioTelemetryModule && "function" == typeof audioTelemetryModule.now ? audioTelemetryModule.now() : "undefined" != typeof performance && "function" == typeof performance.now ? performance.now() : Date.now();
    }
    const mediaSessionApi = window.InfraMediaSession || null;
    const FAVORITES_RESET_DB_MARKER = (window.InfraFavorites && window.InfraFavorites.constants ? window.InfraFavorites.constants : {}).RESET_DB_MARKER || "__infra_favorites_reset_audiofix212__", runtime = function() {
        const scriptEl = document.currentScript || Array.from(document.getElementsByTagName("script")).find(el => /(?:^|\/)scripts\.js(?:\?|$)/.test(String(el.src || "")));
        let scriptUrl;
        try {
            scriptUrl = scriptEl && scriptEl.src ? new URL(scriptEl.src, window.location.href) : null;
        } catch (_err) {
            scriptUrl = null;
        }
        const baseUrl = scriptUrl ? new URL("../../", scriptUrl.href) : function() {
            const url = new URL(window.location.href);
            return /\/(?:apps|music|sphragis)\/[^/]*$/i.test(url.pathname) ? new URL("../", url.href) : new URL("./", url.href);
        }();
        return {
            scriptUrl: scriptUrl || new URL("assets/js/scripts.js", baseUrl.href),
            baseUrl: baseUrl,
            query: scriptUrl && scriptUrl.search || "?v=audiofix301-20260711"
        };
    }(), mediaSessionRuntimeApi = function() {
        const factory = mediaSessionApi && "function" == typeof mediaSessionApi.createMediaSessionRuntime ? mediaSessionApi.createMediaSessionRuntime : null;
        return factory ? factory({
            audioState: audioState,
            runtime: runtime,
            covers: coverApi,
            normalizeUrlAgainstBase: normalizeUrlAgainstBase,
            mergeTrackMetadata: mergeTrackMetadata,
            resolveTracksAlbumArtwork: resolveTracksAlbumArtwork,
            resolveCatalogAlbumArtwork: resolveCatalogAlbumArtwork,
            normalizeTrackTitle: normalizeTrackTitle,
            normalizeAlbumTitle: normalizeAlbumTitle,
            getCurrentAlbumTitle: getCurrentAlbumTitle,
            getCurrentPlaylistTrack: getCurrentPlaylistTrack,
            playFromExternalControl: playFromExternalControl,
            cancelExternalResumeCommand: cancelExternalResumeCommand,
            markAudioPauseIntent: markAudioPauseIntent,
            playPrevious: playPrevious,
            playNext: playNext,
            trackAudioRuntimeEvent: trackAudioRuntimeEvent,
            buildAudioMonitorPayload: buildAudioMonitorPayload,
            getAudioRuntimeProbeState: getAudioRuntimeProbeState,
            srcMatches: srcMatches,
            getCurrentLogicalAudioSrc: getCurrentLogicalAudioSrc
        }) : {};
    }(), siteRuntimeApi = function() {
        const factory = window.InfraSiteRuntime && "function" == typeof window.InfraSiteRuntime.createSiteRuntime ? window.InfraSiteRuntime.createSiteRuntime : null;
        return factory ? factory({
            runtime: runtime,
            navigateTo: navigateTo,
            getQuickActions: getQuickActions
        }) : {};
    }();
    function isAdminModeEnabled() {
        return siteRuntimeApi.isAdminModeEnabled();
    }
    function applyThemePreset(name, persist) {
        return siteRuntimeApi.applyThemePreset(name, persist);
    }
    function initThemePreset() {
        return siteRuntimeApi.initThemePreset();
    }
    function getPwaStatusColor() {
        return siteRuntimeApi.getPwaStatusColor.apply(siteRuntimeApi, arguments);
    }
    function getMediaSessionFallbackArtwork() {
        return mediaSessionRuntimeApi.getMediaSessionFallbackArtwork();
    }
    function getCurrentThemeColor() {
        return siteRuntimeApi.getCurrentThemeColor();
    }
    function setThemeColor(color) {
        return siteRuntimeApi.setThemeColor(color);
    }
    function syncPwaStatusColor() {
        return siteRuntimeApi.syncPwaStatusColor();
    }
    function initAdminFeatures() {
        return siteRuntimeApi.initAdminFeatures();
    }
    function teardownAdminFeatures() {
        return siteRuntimeApi.teardownAdminFeatures();
    }
    function getThemePreset() {
        return siteRuntimeApi.getThemePreset();
    }
    siteRuntimeApi.normalizePwaHeadAssetLinks();
    const audioTelemetryApi = function() {
        const factory = audioTelemetryModule && "function" == typeof audioTelemetryModule.createTelemetry ? audioTelemetryModule.createTelemetry : null;
        return factory ? factory({
            fineTelemetryEnabled: !0,
            getWorkerUrl: function() {
                return WORKER_URL;
            },
            getRuntimeVersion: function() {
                return "audiofix301-20260711";
            },
            getAudioState: function() {
                return audioState;
            },
            getAudio: function() {
                return audioState.audio || null;
            },
            getAudioSource: getAudioSource,
            isIosDevice: isIosDevice,
            isStandaloneDisplayMode: isStandaloneDisplayMode,
            isAndroidDevice: isAndroidDevice,
            getCurrentPlayableAudioSrc: getCurrentPlayableAudioSrc,
            getCurrentPlaylistTrack: getCurrentPlaylistTrack,
            buildMonitorPayload: buildAudioMonitorPayload
        }) : {};
    }();
    const pwaRuntimeApi = function() {
        const factory = window.InfraPwaRuntime && "function" == typeof window.InfraPwaRuntime.createPwaRuntime ? window.InfraPwaRuntime.createPwaRuntime : null;
        if (!factory) return {
            registerServiceWorker: function() {},
            scheduleDeferredServiceWorkerReload: function() {},
            requestServiceWorkerUpdateCheck: function() {},
            getControllerChangeAt: function() {
                return 0;
            },
            getReloadExecutedAt: function() {
                return 0;
            }
        };
        return factory({
            audioState: audioState,
            runtime: runtime,
            runtimeVersion: "audiofix301-20260711",
            now: getAudioTelemetryNow,
            getCurrentPlayableAudioSrc: getCurrentPlayableAudioSrc,
            trackAudioRuntimeEvent: trackAudioRuntimeEvent,
            flushAudioTelemetryQueue: flushAudioTelemetryQueue,
            minIdleMs: 8e3,
            minVisibleMs: 2e3,
            updateCheckMinMs: 6e4
        });
    }();
    const fallbackCatalog = window.InfraFallbackCatalog && "object" == typeof window.InfraFallbackCatalog ? window.InfraFallbackCatalog : {
        apps: [],
        albums: [],
        clips: []
    }, catalogState = {
        data: null,
        loadingPromise: null,
        quickActions: [],
        albumGridObserver: null,
        albumGridScrollHandler: null
    }, clipState = {
        clips: [],
        activeId: "",
        currentSrc: ""
    }, homeCatalogApi = function() {
        const module = window.InfraHomeCatalog && "object" == typeof window.InfraHomeCatalog ? window.InfraHomeCatalog : null, factory = module && "function" == typeof module.createHomeCatalog ? module.createHomeCatalog : null;
        return factory ? factory({
            fallbackCatalog: fallbackCatalog,
            catalogState: catalogState,
            clipState: clipState,
            albumGridInitialBatch: 8,
            albumGridNextBatch: 6,
            displayAlbumCardTitle: displayAlbumCardTitle,
            sanitizeCatalog: sanitizeCatalog,
            loadCatalogData: loadCatalogData
        }) : {};
    }();
    const audioRadioApi = function() {
        const module = window.InfraAudioRadio && "object" == typeof window.InfraAudioRadio ? window.InfraAudioRadio : null, factory = module && "function" == typeof module.createAudioRadio ? module.createAudioRadio : null;
        return factory ? factory({
            audioState: audioState,
            runtime: runtime,
            PREFETCH_NEXT_ENABLED: PREFETCH_NEXT_ENABLED,
            loadTracksData: loadTracksData,
            toRuntimeAbsoluteUrl: toRuntimeAbsoluteUrl,
            normalizeAlbumTitle: normalizeAlbumTitle,
            normalizeTrackTitle: normalizeTrackTitle,
            resolveManagedAudioSrc: resolveManagedAudioSrc,
            getAudioAssetPathKey: getAudioAssetPathKey,
            formatTrackDuration: formatTrackDuration,
            trackAudioRuntimeEvent: trackAudioRuntimeEvent,
            srcMatches: srcMatches,
            getCurrentLogicalAudioSrc: getCurrentLogicalAudioSrc,
            toAbsoluteUrlOrEmpty: toAbsoluteUrlOrEmpty,
            getCurrentPlayableAudioSrc: getCurrentPlayableAudioSrc,
            normalizeAudioSourceUrl: normalizeAudioSourceUrl,
            isCloudflareAudioUrl: isCloudflareAudioUrl,
            startNextTrackPrefetch: startNextTrackPrefetch,
            syncAudioUi: syncAudioUi,
            syncMediaSessionMetadata: syncMediaSessionMetadata,
            getCurrentPlaylistTrack: getCurrentPlaylistTrack,
            syncPlaylistContext: syncPlaylistContext,
            buildPreservedTrack: buildPreservedTrack,
            playPrevious: playPrevious,
            playNext: playNext,
            startTrack: startTrack,
            startRadioPlaybackFromIdle: startRadioPlaybackFromIdle,
            getCurrentPlaylistIndexSafe: getCurrentPlaylistIndexSafe,
            getRandomIndex: getRandomIndex,
            togglePlayPause: togglePlayPause,
            getCurrentTrackArtwork: getCurrentTrackArtwork,
            getCurrentAlbumTitle: getCurrentAlbumTitle,
            getCurrentTrackAlbumPage: getCurrentTrackAlbumPage,
            toAbsoluteUrl: toAbsoluteUrl,
            ensureCurrentIndexFromAudio: ensureCurrentIndexFromAudio,
            revokeActiveBlobUrl: revokeActiveBlobUrl,
            clearFadeTimer: clearFadeTimer,
            clearWaitingRecovery: clearWaitingRecovery,
            readNowPlayingVolumeVisible: readNowPlayingVolumeVisible,
            getSpaPersistRoot: getSpaPersistRoot,
            bindMediaSessionActions: bindMediaSessionActions,
            ensureGlobalTransportUi: ensureGlobalTransportUi,
            syncTransportUi: syncTransportUi,
            clearTrackFailureForCurrent: clearTrackFailureForCurrent,
            clearTrackStatus: clearTrackStatus,
            getTrackByIndex: getTrackByIndex,
            startAudioTelemetryHeartbeat: startAudioTelemetryHeartbeat,
            stopAudioTelemetryHeartbeat: stopAudioTelemetryHeartbeat,
            markAudioTelemetryInactive: markAudioTelemetryInactive,
            buildAudioMonitorPayload: buildAudioMonitorPayload,
            getAudioBufferedEnd: getAudioBufferedEnd,
            scheduleDeferredServiceWorkerReload: scheduleDeferredServiceWorkerReload,
            syncCurrentTrackDurationFromAudio: syncCurrentTrackDurationFromAudio,
            maybePrefetchNextTrack: maybePrefetchNextTrack,
            logAudioAuditEvent: logAudioAuditEvent,
            setTrackStatus: setTrackStatus,
            scheduleWaitingRecovery: scheduleWaitingRecovery,
            getAudioRuntimeProbeState: getAudioRuntimeProbeState,
            confirmAudioRecovery: confirmAudioRecovery,
            sendAudioMonitoringLog: sendAudioMonitoringLog,
            recoverFromTrackFailure: recoverFromTrackFailure,
            updateProgressUi: updateProgressUi,
            isBlobObjectUrl: isBlobObjectUrl,
            extendAlbumPlaylistToNextAlbum: extendAlbumPlaylistToNextAlbum,
            prefetchApi: prefetchApi,
            PREFETCH_NEXT_CACHE_NAME: PREFETCH_NEXT_CACHE_NAME,
            PREFETCH_NEXT_MAX_BYTES: PREFETCH_NEXT_MAX_BYTES,
            PREFETCH_NEXT_THRESHOLD_SECONDS: PREFETCH_NEXT_THRESHOLD_SECONDS
        }) : {};
    }();
    function callAudioRadio(name, args) {
        const fn = audioRadioApi && "function" == typeof audioRadioApi[name] ? audioRadioApi[name] : null;
        return fn ? fn.apply(audioRadioApi, args || []) : void 0;
    }
    const audioCoreApi = function() {
        const module = window.InfraAudioCore && "object" == typeof window.InfraAudioCore ? window.InfraAudioCore : null, factory = module && "function" == typeof module.createAudioCore ? module.createAudioCore : null;
        return factory ? factory({
            audioState: audioState,
            PREFETCH_NEXT_ENABLED: PREFETCH_NEXT_ENABLED,
            savePlaybackQueueContext: savePlaybackQueueContext,
            getCurrentLogicalAudioSrc: getCurrentLogicalAudioSrc,
            srcMatches: srcMatches,
            extractFilenameFromSrc: extractFilenameFromSrc,
            hashString: hashString,
            ensureRadioQueue: ensureRadioQueue,
            normalizeAudioSourceUrl: normalizeAudioSourceUrl,
            revokeActiveBlobUrl: revokeActiveBlobUrl,
            loadMediaElementForPlayback: loadMediaElementForPlayback,
            toAbsoluteUrlOrEmpty: toAbsoluteUrlOrEmpty,
            getCurrentPlayableAudioSrc: getCurrentPlayableAudioSrc,
            registerTrackFailure: registerTrackFailure,
            getTrackByIndex: getTrackByIndex,
            setTrackStatus: setTrackStatus,
            clearFadeTimer: clearFadeTimer,
            syncAudioUi: syncAudioUi,
            clearWaitingRecovery: clearWaitingRecovery,
            clearOtherTrackStatuses: clearOtherTrackStatuses,
            clearTrackStatus: clearTrackStatus,
            getAudioTelemetryNow: getAudioTelemetryNow,
            getAudioAssetPath: getAudioAssetPath,
            trackAudioRuntimeEvent: trackAudioRuntimeEvent,
            buildAudioMonitorPayload: buildAudioMonitorPayload,
            logAudioAuditEvent: logAudioAuditEvent,
            getAudioSource: getAudioSource,
            clearNextTrackPrefetch: clearNextTrackPrefetch,
            resetPreparedInitialGlobalRandomPlayback: resetPreparedInitialGlobalRandomPlayback,
            clearTrackFailure: clearTrackFailure,
            fadeInAudio: fadeInAudio,
            forceAudioFullVolume: forceAudioFullVolume,
            bindMediaSessionActions: bindMediaSessionActions,
            syncMediaSessionMetadata: syncMediaSessionMetadata,
            scheduleMediaSessionResync: scheduleMediaSessionResync,
            startAudioRaf: startAudioRaf,
            fadeOutAudio: fadeOutAudio,
            isIosDevice: isIosDevice,
            scheduleSilentCheck: scheduleSilentCheck,
            getAutoPrefetchedNextIndex: getAutoPrefetchedNextIndex,
            ensureRadioPlaylistForNavigation: ensureRadioPlaylistForNavigation,
            ensurePlayablePlaylistContext: ensurePlayablePlaylistContext,
            canStartInitialGlobalRandomPlayback: canStartInitialGlobalRandomPlayback,
            startGlobalRandomPlayback: startGlobalRandomPlayback,
            ensureRadioPlaylistLoaded: ensureRadioPlaylistLoaded,
            syncRadioQueueToPlaylist: syncRadioQueueToPlaylist,
            updateProgressUi: updateProgressUi,
            saveResumeState: saveResumeState,
            markAudioPauseIntent: markAudioPauseIntent,
            extendAlbumPlaylistToNextAlbum: extendAlbumPlaylistToNextAlbum,
            beginAudioRecovery: beginAudioRecovery,
            failAudioRecovery: failAudioRecovery
        }) : {};
    }();
    const coverRuntimeApi = function() {
        const module = window.InfraCovers && "object" == typeof window.InfraCovers ? window.InfraCovers : null, factory = module && "function" == typeof module.createRuntime ? module.createRuntime : null;
        return factory ? factory({
            audioState: audioState,
            spaState: spaState,
            COVERS_CACHE_NAME: COVERS_CACHE_NAME,
            COVER_SESSION_PREPARE_ENABLED: COVER_SESSION_PREPARE_ENABLED,
            COVER_SESSION_PREPARE_CONCURRENCY: COVER_SESSION_PREPARE_CONCURRENCY,
            PWA_COVER_PREPARE_LIMIT: 8,
            ALBUM_COVER_IMAGE_CACHE_LIMIT: ALBUM_COVER_IMAGE_CACHE_LIMIT,
            toAbsoluteUrlOrEmpty: toAbsoluteUrlOrEmpty,
            toRuntimeAbsoluteUrl: toRuntimeAbsoluteUrl,
            normalizeAlbumTitle: normalizeAlbumTitle,
            getImagePreferredSrc: getImagePreferredSrc,
            isMobilePwaCoverNavigation: isMobilePwaCoverNavigation,
            isAlbumOpenUrl: isAlbumOpenUrl,
            choosePreferredSrcsetSource: choosePreferredSrcsetSource,
            getSpaPersistRoot: getSpaPersistRoot,
            normalizeUrlAgainstBase: normalizeUrlAgainstBase,
            preloadImage: preloadImage,
            loadTracksData: loadTracksData,
            getCurrentAlbumTitle: getCurrentAlbumTitle,
            getAlbumNameFromUrlLike: getAlbumNameFromUrlLike,
            getAudioTelemetryNow: getAudioTelemetryNow,
            trackAudioRuntimeEvent: trackAudioRuntimeEvent
        }) : {};
    }();
    function callCoverRuntime(name, args) {
        const fn = coverRuntimeApi && "function" == typeof coverRuntimeApi[name] ? coverRuntimeApi[name] : null;
        return fn ? fn.apply(coverRuntimeApi, args || []) : void 0;
    }
    function getResourceTimingHint() {
        return callCoverRuntime("getResourceTimingHint", arguments);
    }
    function logCoverRuntimeEvent() {
        return callCoverRuntime("logCoverRuntimeEvent", arguments);
    }
    function primeLinkedAlbumCoverForPwa() {
        return callCoverRuntime("primeLinkedAlbumCoverForPwa", arguments);
    }
    function releasePwaCoverHold() {
        return callCoverRuntime("releasePwaCoverHold", arguments);
    }
    function showPwaCoverHold() {
        return callCoverRuntime("showPwaCoverHold", arguments);
    }
    function showPwaHomeReturnHold() {
        return callCoverRuntime("showPwaHomeReturnHold", arguments);
    }
    function rememberAlbumCoverImage() {
        return callCoverRuntime("rememberAlbumCoverImage", arguments);
    }
    function prepareAlbumCoversForSession() {
        return callCoverRuntime("prepareAlbumCoversForSession", arguments);
    }
    function scheduleAlbumCoverCacheWarmup() {
        return callCoverRuntime("scheduleAlbumCoverCacheWarmup", arguments);
    }
    function optimizeAlbumCoverImage() {
        return callCoverRuntime("optimizeAlbumCoverImage", arguments);
    }
    const spaRendererApi = function() {
        const module = window.InfraSpaRenderer && "object" == typeof window.InfraSpaRenderer ? window.InfraSpaRenderer : null, factory = module && "function" == typeof module.createSpaRenderer ? module.createSpaRenderer : null;
        return factory ? factory({
            spaState: spaState,
            audioState: audioState,
            spaRouterApi: spaRouterApi,
            COVERS_CACHE_NAME: COVERS_CACHE_NAME,
            COVER_SESSION_NAVIGATION_GATE_ENABLED: COVER_SESSION_NAVIGATION_GATE_ENABLED,
            COVER_SESSION_PREPARE_ENABLED: COVER_SESSION_PREPARE_ENABLED,
            setSpaCachedHtml: setSpaCachedHtml,
            getSpaCachedHtml: getSpaCachedHtml,
            getSpaPersistRoot: getSpaPersistRoot,
            normalizeCoverElementsForBase: normalizeCoverElementsForBase,
            absolutizeSrcsetForBase: absolutizeSrcsetForBase,
            getAudioTelemetryNow: getAudioTelemetryNow,
            trackAudioRuntimeEvent: trackAudioRuntimeEvent,
            parseSrcsetCandidates: parseSrcsetCandidates,
            normalizeUrlAgainstBase: normalizeUrlAgainstBase,
            prepareAlbumCoversForSession: prepareAlbumCoversForSession,
            rememberAlbumCoverImage: rememberAlbumCoverImage,
            saveCurrentScrollPositionInHistory: saveCurrentScrollPositionInHistory,
            buildSpaHistoryState: buildSpaHistoryState,
            getAlbumNameFromUrlLike: getAlbumNameFromUrlLike,
            getCurrentAlbumTitle: getCurrentAlbumTitle,
            createAlbumOpenTelemetryContext: createAlbumOpenTelemetryContext,
            finishAlbumOpenTelemetry: finishAlbumOpenTelemetry,
            initPage: initPage,
            resumeLiveHomeRoute: resumeLiveHomeRoute,
            logAudioRuntimeAlbumSwitch: logAudioRuntimeAlbumSwitch,
            getScrollFromHistoryState: getScrollFromHistoryState,
            prefetchSpaPage: prefetchSpaPage,
            releasePwaCoverHold: releasePwaCoverHold,
            showPwaHomeReturnHold: showPwaHomeReturnHold,
            isStandaloneDisplayMode: isStandaloneDisplayMode,
            isIosDevice: isIosDevice,
            isAndroidDevice: isAndroidDevice
        }) : {};
    }();
    function callSpaRenderer(name, args) {
        const fn = spaRendererApi && "function" == typeof spaRendererApi[name] ? spaRendererApi[name] : null;
        return fn ? fn.apply(spaRendererApi, args || []) : void 0;
    }
    function snapshotCurrentSpaPage() {
        return callSpaRenderer("snapshotCurrentSpaPage", arguments);
    }
    function getImagePreferredSrc() {
        return callSpaRenderer("getImagePreferredSrc", arguments);
    }
    function spaNavigate() {
        return callSpaRenderer("spaNavigate", arguments);
    }
    const spaControllerApi = function() {
        const factory = window.InfraSpaController && "function" == typeof window.InfraSpaController.createSpaController ? window.InfraSpaController.createSpaController : null;
        return factory ? factory({
            spaState: spaState,
            audioState: audioState,
            runtime: runtime,
            spaRouterApi: spaRouterApi,
            spaNavigate: spaNavigate,
            snapshotCurrentSpaPage: snapshotCurrentSpaPage,
            primeLinkedAlbumCoverForPwa: primeLinkedAlbumCoverForPwa,
            showPwaCoverHold: showPwaCoverHold,
            prefetchSpaPage: prefetchSpaPage,
            loadTracksData: loadTracksData,
            normalizeUrlAgainstBase: normalizeUrlAgainstBase,
            getCurrentPlayableAudioSrc: getCurrentPlayableAudioSrc,
            isIosDevice: isIosDevice,
            isAdminModeEnabled: isAdminModeEnabled,
            applyThemePreset: applyThemePreset,
            initThemePreset: initThemePreset,
            closeNowPlayingOverlay: closeNowPlayingOverlay,
            cleanupIdleAudioContext: cleanupIdleAudioContext,
            ensureGlobalAudio: ensureGlobalAudio,
            ensurePlayablePlaylistContext: ensurePlayablePlaylistContext,
            syncFavoriteButtons: syncFavoriteButtons,
            syncFavoritesRoute: syncFavoritesRoute,
            syncTransportUi: syncTransportUi,
            resetHomePlaybackModeIfIdle: resetHomePlaybackModeIfIdle,
            setHomePlayMode: setHomePlayMode,
            syncAudioUi: syncAudioUi,
            scheduleFavoritesPreload: scheduleFavoritesPreload,
            scheduleAlbumCoverCacheWarmup: scheduleAlbumCoverCacheWarmup,
            initPwaInstallPrompt: initPwaInstallPrompt,
            shouldInitAudioFeatures: shouldInitAudioFeatures,
            loadTrackDurationData: loadTrackDurationData,
            initAudioSessionTelemetry: initAudioSessionTelemetry,
            initHomeFavoritesButton: initHomeFavoritesButton,
            initFavoritesRoute: initFavoritesRoute,
            loadFavoritesWithReset: loadFavoritesWithReset,
            loadCatalogData: loadCatalogData,
            hydrateHomeCatalog: hydrateHomeCatalog,
            prepareAlbumCoversForSession: prepareAlbumCoversForSession,
            optimizeAlbumCoverImage: optimizeAlbumCoverImage,
            enhanceAlbumDownloadButtons: enhanceAlbumDownloadButtons,
            hydrateCurrentAlbumTrackRows: hydrateCurrentAlbumTrackRows,
            initMinimalPlayers: initMinimalPlayers,
            scheduleInitialGlobalRandomPreparation: scheduleInitialGlobalRandomPreparation,
            initAdminFeatures: initAdminFeatures,
            teardownAdminFeatures: teardownAdminFeatures
        }) : {};
    }();
    function navigateTo() {
        return spaControllerApi.navigateTo.apply(spaControllerApi, arguments);
    }
    function buildSpaHistoryState() {
        return spaControllerApi.buildSpaHistoryState.apply(spaControllerApi, arguments);
    }
    function saveCurrentScrollPositionInHistory() {
        return spaControllerApi.saveCurrentScrollPositionInHistory.apply(spaControllerApi, arguments);
    }
    function getScrollFromHistoryState() {
        return spaControllerApi.getScrollFromHistoryState.apply(spaControllerApi, arguments);
    }
    function getSpaCachedHtml() {
        return spaControllerApi.getSpaCachedHtml.apply(spaControllerApi, arguments);
    }
    function setSpaCachedHtml() {
        return spaControllerApi.setSpaCachedHtml.apply(spaControllerApi, arguments);
    }
    function absolutizeSrcsetForBase() {
        return spaControllerApi.absolutizeSrcsetForBase.apply(spaControllerApi, arguments);
    }
    function normalizeCoverElementsForBase() {
        return spaControllerApi.normalizeCoverElementsForBase.apply(spaControllerApi, arguments);
    }
    function getSpaPersistRoot() {
        return spaControllerApi.getSpaPersistRoot.apply(spaControllerApi, arguments);
    }
    function resumeLiveHomeRoute() {
        return spaControllerApi.resumeLiveHomeRoute();
    }
    function initPage() {
        return spaControllerApi.initPage();
    }
    const albumPlayerUiApi = function() {
        const module = window.InfraAlbumPlayerUi && "object" == typeof window.InfraAlbumPlayerUi ? window.InfraAlbumPlayerUi : null, factory = module && "function" == typeof module.createAlbumPlayerUi ? module.createAlbumPlayerUi : null;
        return factory ? factory({
            audioState: audioState,
            runtime: runtime,
            TRACK_CLICK_COOLDOWN_MS: 180,
            getAudioAssetPathKey: getAudioAssetPathKey,
            fetchLiveCatalogDocument: fetchLiveCatalogDocument,
            isDurationsDocument: isDurationsDocument,
            fetchLocalCatalogDocument: fetchLocalCatalogDocument,
            getTrackMetaByAssetPath: getTrackMetaByAssetPath,
            getCurrentLogicalAudioSrc: getCurrentLogicalAudioSrc,
            srcMatches: srcMatches,
            syncTransportUi: syncTransportUi,
            updateProgressUi: updateProgressUi,
            savePlaybackQueueContext: savePlaybackQueueContext,
            syncMediaSessionMetadata: syncMediaSessionMetadata,
            ensureGlobalAudio: ensureGlobalAudio,
            ensureAlbumFavoriteSelectionToolbar: ensureAlbumFavoriteSelectionToolbar,
            toAbsoluteUrl: toAbsoluteUrl,
            getCurrentAlbumTitle: getCurrentAlbumTitle,
            resolveTracksAlbumArtwork: resolveTracksAlbumArtwork,
            getAlbumCoverFromDoc: getAlbumCoverFromDoc,
            resolveManagedAudioSrc: resolveManagedAudioSrc,
            normalizeFavoritePath: normalizeFavoritePath,
            normalizeTrackTitle: normalizeTrackTitle,
            ensureAlbumFavoriteControls: ensureAlbumFavoriteControls,
            toggleAlbumFavoriteSelection: toggleAlbumFavoriteSelection,
            togglePlayPause: togglePlayPause,
            clearTrackFailure: clearTrackFailure,
            resetAudioElementForSource: resetAudioElementForSource,
            startTrack: startTrack,
            cleanupForeignAlbumAudioWhenIdle: cleanupForeignAlbumAudioWhenIdle,
            syncPlaylistContext: syncPlaylistContext,
            syncRadioQueueToPlaylist: syncRadioQueueToPlaylist,
            buildPreservedTrack: buildPreservedTrack,
            injectCurrentTrackIntoRadioQueue: injectCurrentTrackIntoRadioQueue
        }) : {};
    }();
    function callAlbumPlayerUi(name, args) {
        const fn = albumPlayerUiApi && "function" == typeof albumPlayerUiApi[name] ? albumPlayerUiApi[name] : null;
        return fn ? fn.apply(albumPlayerUiApi, args || []) : void 0;
    }
    function formatTrackDuration() {
        return callAlbumPlayerUi("formatTrackDuration", arguments);
    }
    function rememberTrackDuration() {
        return callAlbumPlayerUi("rememberTrackDuration", arguments);
    }
    function getCachedTrackDuration() {
        return callAlbumPlayerUi("getCachedTrackDuration", arguments);
    }
    function loadTrackDurationData() {
        return callAlbumPlayerUi("loadTrackDurationData", arguments);
    }
    function syncCurrentTrackDurationFromAudio() {
        return callAlbumPlayerUi("syncCurrentTrackDurationFromAudio", arguments);
    }
    function syncAudioUi() {
        return callAlbumPlayerUi("syncAudioUi", arguments);
    }
    function initMinimalPlayers() {
        return callAlbumPlayerUi("initMinimalPlayers", arguments);
    }
    function hydrateCurrentAlbumTrackRows() {
        return callAlbumPlayerUi("hydrateCurrentAlbumTrackRows", arguments);
    }
    const nowPlayingApi = function() {
        const module = window.InfraNowPlaying && "object" == typeof window.InfraNowPlaying ? window.InfraNowPlaying : null, factory = module && "function" == typeof module.createNowPlaying ? module.createNowPlaying : null;
        return factory ? factory({
            audioState: audioState,
            NOW_PLAYING_OVERLAY_ENABLED: true,
            isIosDevice: isIosDevice,
            getThemePreset: getThemePreset,
            getPwaStatusColor: getPwaStatusColor,
            isDarkColor: isDarkColor,
            toAbsoluteUrlOrEmpty: toAbsoluteUrlOrEmpty,
            getCurrentThemeColor: getCurrentThemeColor,
            setThemeColor: setThemeColor,
            syncPwaStatusColor: syncPwaStatusColor,
            syncTransportUi: syncTransportUi,
            scheduleDeferredServiceWorkerReload: scheduleDeferredServiceWorkerReload,
            getCurrentPlayableAudioSrc: getCurrentPlayableAudioSrc,
            getCurrentPlaylistTrack: getCurrentPlaylistTrack,
            normalizeTrackTitle: normalizeTrackTitle,
            normalizeAlbumTitle: normalizeAlbumTitle,
            getCurrentAlbumTitle: getCurrentAlbumTitle,
            getCurrentTrackAlbumPage: getCurrentTrackAlbumPage,
            resolveCoverUrl: resolveCoverUrl,
            setCoverWhenReady: setCoverWhenReady,
            getMediaSessionFallbackArtwork: getMediaSessionFallbackArtwork,
            setCoverBackgroundStable: setCoverBackgroundStable,
            syncCurrentFavoriteButtons: syncCurrentFavoriteButtons,
            getCurrentPlaylistIndexSafe: getCurrentPlaylistIndexSafe,
            getQueuePreviewIndices: getQueuePreviewIndices,
            mergeTrackMetadata: mergeTrackMetadata,
            getTrackMetaByAssetPath: getTrackMetaByAssetPath,
            getCachedTrackDuration: getCachedTrackDuration,
            getCurrentTrackArtwork: getCurrentTrackArtwork,
            normalizeArtworkUrl: normalizeArtworkUrl,
            formatTrackDuration: formatTrackDuration
        }) : {};
    }();
    function callNowPlaying(name, args) {
        const fn = nowPlayingApi && "function" == typeof nowPlayingApi[name] ? nowPlayingApi[name] : null;
        return fn ? fn.apply(nowPlayingApi, args || []) : void 0;
    }
    function readNowPlayingVolumeVisible() {
        return callNowPlaying("readNowPlayingVolumeVisible", arguments);
    }
    function toggleNowPlayingVolumeVisible() {
        return callNowPlaying("toggleNowPlayingVolumeVisible", arguments);
    }
    function disableNowPlayingOverlayUi() {
        return callNowPlaying("disableNowPlayingOverlayUi", arguments);
    }
    function openNowPlayingOverlay() {
        return callNowPlaying("openNowPlayingOverlay", arguments);
    }
    function closeNowPlayingOverlay() {
        return callNowPlaying("closeNowPlayingOverlay", arguments);
    }
    function setNowPlayingQueueOpen() {
        return callNowPlaying("setNowPlayingQueueOpen", arguments);
    }
    function syncNowPlayingOverlay() {
        return callNowPlaying("syncNowPlayingOverlay", arguments);
    }
    function syncNowPlayingOverlayProgress() {
        return callNowPlaying("syncNowPlayingOverlayProgress", arguments);
    }
    const transportUiApi = function() {
        const module = window.InfraTransportUi && "object" == typeof window.InfraTransportUi ? window.InfraTransportUi : null, factory = module && "function" == typeof module.createTransportUi ? module.createTransportUi : null;
        return factory ? factory({
            audioState: audioState,
            DESKTOP_TRANSPORT_STORAGE_KEY: "infra_desktop_transport_layout_v2",
            DESKTOP_TRANSPORT_LEGACY_STORAGE_KEY: "infra_desktop_transport_layout_v1",
            DESKTOP_TRANSPORT_MIN_WIDTH: 254,
            DESKTOP_TRANSPORT_MIN_HEIGHT: 116,
            DESKTOP_TRANSPORT_MARGIN: 8,
            DESKTOP_TRANSPORT_DRAG_THRESHOLD: 6,
            DESKTOP_TRANSPORT_COVER_MIN_WIDTH: 380,
            DESKTOP_TRANSPORT_COVER_MIN_HEIGHT: 150,
            HEART_ICON_OUTLINE: HEART_ICON_OUTLINE,
            RADIO_ICON: '<svg class="radio-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="2.25" fill="currentColor"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2" d="M8.4 15.6a5.1 5.1 0 0 1 0-7.2M15.6 8.4a5.1 5.1 0 0 1 0 7.2M5.2 18.8a9.6 9.6 0 0 1 0-13.6M18.8 5.2a9.6 9.6 0 0 1 0 13.6"/></svg>',
            SHUFFLE_ICON: '<svg class="shuffle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.15" d="M3 6h2.7c2.25 0 3.75 1 5.15 3.15l2.3 3.7C14.55 15 16.05 16 18.3 16H21"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.15" d="M3 18h2.7c1.8 0 3.1-.65 4.25-2.05"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.15" d="M14.05 8.05C15.2 6.65 16.5 6 18.3 6H21"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.15" d="m18 3 3 3-3 3"/><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.15" d="m18 13 3 3-3 3"/></svg>',
            resolveCoverUrl: resolveCoverUrl,
            setCoverWhenReady: setCoverWhenReady,
            getCurrentPlaylistTrack: getCurrentPlaylistTrack,
            getMediaSessionFallbackArtwork: getMediaSessionFallbackArtwork,
            bindGlobalKeyboardShortcuts: bindGlobalKeyboardShortcuts,
            getSpaPersistRoot: getSpaPersistRoot,
            toggleRadioModeFromTransport: toggleRadioModeFromTransport,
            playPrevious: playPrevious,
            playNext: playNext,
            movePlaylistItem: movePlaylistItem,
            handleGlobalTransportToggle: handleGlobalTransportToggle,
            toggleAlbumShuffleMode: toggleAlbumShuffleMode,
            toggleCurrentFavorite: toggleCurrentFavorite,
            openNowPlayingOverlay: openNowPlayingOverlay,
            closeNowPlayingOverlay: closeNowPlayingOverlay,
            disableNowPlayingOverlayUi: disableNowPlayingOverlayUi,
            togglePlayPause: togglePlayPause,
            setNowPlayingQueueOpen: setNowPlayingQueueOpen,
            startTrack: startTrack,
            toggleNowPlayingVolumeVisible: toggleNowPlayingVolumeVisible,
            isIosDevice: isIosDevice,
            seekCurrentAudioToRatio: seekCurrentAudioToRatio,
            updateProgressUi: updateProgressUi,
            syncNowPlayingOverlay: syncNowPlayingOverlay,
            syncNowPlayingOverlayProgress: syncNowPlayingOverlayProgress,
            getCurrentPlayableAudioSrc: getCurrentPlayableAudioSrc,
            formatTrackDuration: formatTrackDuration,
            ensurePlayablePlaylistContext: ensurePlayablePlaylistContext,
            hasPlaybackSession: hasPlaybackSession,
            canStartInitialGlobalRandomPlayback: canStartInitialGlobalRandomPlayback,
            normalizeTrackTitle: normalizeTrackTitle,
            normalizeAlbumTitle: normalizeAlbumTitle,
            getCurrentAlbumTitle: getCurrentAlbumTitle,
            getCurrentTrackAlbumPage: getCurrentTrackAlbumPage,
            syncCurrentFavoriteButtons: syncCurrentFavoriteButtons
        }) : {};
    }();
    function callTransportUi(name, args) {
        const fn = transportUiApi && "function" == typeof transportUiApi[name] ? transportUiApi[name] : null;
        return fn ? fn.apply(transportUiApi, args || []) : void 0;
    }
    function ensureGlobalTransportUi() {
        return callTransportUi("ensureGlobalTransportUi", arguments);
    }
    function syncTransportUi() {
        return callTransportUi("syncTransportUi", arguments);
    }
    const favoritesUiApi = function() {
        const module = window.InfraFavoritesUi && "object" == typeof window.InfraFavoritesUi ? window.InfraFavoritesUi : null, factory = module && "function" == typeof module.createFavoritesUi ? module.createFavoritesUi : null;
        return factory ? factory({
            audioState: audioState,
            runtime: runtime,
            FAVORITES_RESET_DB_MARKER: FAVORITES_RESET_DB_MARKER,
            HEART_ICON_FILLED: '<svg class="heart-icon heart-icon-filled" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M6.98 3.07a6 6 0 0 1 4.99 1.43l.03.03.04-.03a6 6 0 0 1 8.34 8.61l-.18.18-.05.04-7.45 7.38a1 1 0 0 1-1.31.08l-.09-.08-7.5-7.42A6 6 0 0 1 6.98 3.07Z"/></svg>',
            HEART_ICON_OUTLINE: HEART_ICON_OUTLINE,
            DOWNLOAD_ICON: '<svg class="album-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v10m0 0 4-4m-4 4-4-4M5 19h14"/></svg>',
            SELECT_MODE_ICON: '<svg class="album-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m8.8 12.2 2.15 2.15 4.7-4.7"/><circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" stroke-width="1.9"/></svg>',
            DONE_MODE_ICON: '<svg class="album-action-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.1" d="M6 6l12 12M18 6 6 18"/></svg>',
            infraDownloadsApi: infraDownloadsApi,
            getAudioAssetPathKey: getAudioAssetPathKey,
            getAudioTelemetryNow: getAudioTelemetryNow,
            getCurrentAlbumTitle: getCurrentAlbumTitle,
            trackAudioRuntimeEvent: trackAudioRuntimeEvent,
            loadTracksData: loadTracksData,
            getCurrentPlaylistTrack: getCurrentPlaylistTrack,
            getCurrentLogicalAudioSrc: getCurrentLogicalAudioSrc,
            mergeTrackMetadata: mergeTrackMetadata,
            getTrackMetaByAssetPath: getTrackMetaByAssetPath,
            resolveManagedAudioSrc: resolveManagedAudioSrc,
            clearRadioQueue: clearRadioQueue,
            persistHomePlayMode: persistHomePlayMode,
            syncPlaylistContext: syncPlaylistContext,
            syncMediaSessionMetadata: syncMediaSessionMetadata,
            syncAudioUi: syncAudioUi,
            getRandomIndex: getRandomIndex,
            startTrack: startTrack,
            resolveCoverUrl: resolveCoverUrl,
            srcMatches: srcMatches,
            getMediaSessionFallbackArtwork: getMediaSessionFallbackArtwork,
            formatTrackDuration: formatTrackDuration
        }) : {};
    }();
    function callFavoritesUi(name, args) {
        const fn = favoritesUiApi && "function" == typeof favoritesUiApi[name] ? favoritesUiApi[name] : null;
        return fn ? fn.apply(favoritesUiApi, args || []) : void 0;
    }
    function canonicalFavoritePath() {
        return callFavoritesUi("canonicalFavoritePath", arguments);
    }
    function normalizeFavoritePath() {
        return callFavoritesUi("normalizeFavoritePath", arguments);
    }
    function loadFavoritesWithReset() {
        return callFavoritesUi("loadFavoritesWithReset", arguments);
    }
    function syncCurrentFavoriteButtons() {
        return callFavoritesUi("syncCurrentFavoriteButtons", arguments);
    }
    function syncFavoriteButtons() {
        return callFavoritesUi("syncFavoriteButtons", arguments);
    }
    function toggleAlbumFavoriteSelection() {
        return callFavoritesUi("toggleAlbumFavoriteSelection", arguments);
    }
    function ensureAlbumFavoriteSelectionToolbar() {
        return callFavoritesUi("ensureAlbumFavoriteSelectionToolbar", arguments);
    }
    function ensureAlbumFavoriteControls() {
        return callFavoritesUi("ensureAlbumFavoriteControls", arguments);
    }
    function toggleCurrentFavorite() {
        return callFavoritesUi("toggleCurrentFavorite", arguments);
    }
    function initHomeFavoritesButton() {
        return callFavoritesUi("initHomeFavoritesButton", arguments);
    }
    function enhanceAlbumDownloadButtons() {
        return callFavoritesUi("enhanceAlbumDownloadButtons", arguments);
    }
    function scheduleFavoritesPreload() {
        return callFavoritesUi("scheduleFavoritesPreload", arguments);
    }
    function syncFavoritesRoute() {
        return callFavoritesUi("syncFavoritesRoute", arguments);
    }
    function initFavoritesRoute() {
        return callFavoritesUi("initFavoritesRoute", arguments);
    }
    const catalogLoaderApi = function() {
        const factory = window.InfraCatalogLoader && "function" == typeof window.InfraCatalogLoader.createLoader ? window.InfraCatalogLoader.createLoader : null;
        return factory ? factory({
            fallbackCatalog: fallbackCatalog,
            catalogState: catalogState,
            audioState: audioState,
            runtime: runtime,
            WORKER_URL: WORKER_URL,
            LIVE_CATALOG_CACHE_NAME: "infra-live-catalog-v1",
            LIVE_CATALOG_TIMEOUT_MS: 3500,
            LOCAL_CATALOG_VERSION: "audiofix301-20260711",
            normalizeAlbumTitle: normalizeAlbumTitle,
            normalizeTrackTitle: normalizeTrackTitle,
            toRuntimeAbsoluteUrl: toRuntimeAbsoluteUrl,
            getAudioAssetPathKey: getAudioAssetPathKey,
            canonicalFavoritePath: canonicalFavoritePath,
            formatTrackDuration: formatTrackDuration,
            rememberTrackDuration: rememberTrackDuration,
            resolveManagedAudioSrc: resolveManagedAudioSrc,
            getCurrentLogicalAudioSrc: getCurrentLogicalAudioSrc
        }) : {};
    }();
    function sanitizeCatalog(raw) {
        return catalogLoaderApi.sanitizeCatalog(raw);
    }
    function isDurationsDocument(payload) {
        return catalogLoaderApi.isDurationsDocument(payload);
    }
    function fetchLiveCatalogDocument(fileName, validate) {
        return catalogLoaderApi.fetchLiveCatalogDocument(fileName, validate);
    }
    function fetchLocalCatalogDocument(fileName) {
        return catalogLoaderApi.fetchLocalCatalogDocument(fileName);
    }
    function loadCatalogData() {
        return catalogLoaderApi.loadCatalogData();
    }
    function loadTracksData() {
        return catalogLoaderApi.loadTracksData();
    }
    function getTrackMetaByAssetPath(srcLike, baseUrl) {
        return catalogLoaderApi.getTrackMetaByAssetPath(srcLike, baseUrl);
    }
    function mergeTrackMetadata(track) {
        return catalogLoaderApi.mergeTrackMetadata(track);
    }
    function persistHomePlayMode() {
        return callAudioRadio("persistHomePlayMode", arguments);
    }
    function ensureRadioPlaylistLoaded() {
        return callAudioRadio("ensureRadioPlaylistLoaded", arguments);
    }
    function startGlobalRandomPlayback() {
        return callAudioRadio("startGlobalRandomPlayback", arguments);
    }
    function resetPreparedInitialGlobalRandomPlayback() {
        return callAudioRadio("resetPreparedInitialGlobalRandomPlayback", arguments);
    }
    function scheduleInitialGlobalRandomPreparation() {
        return callAudioRadio("scheduleInitialGlobalRandomPreparation", arguments);
    }
    function hasPlaybackSession() {
        return callAudioRadio("hasPlaybackSession", arguments);
    }
    function canStartInitialGlobalRandomPlayback() {
        return callAudioRadio("canStartInitialGlobalRandomPlayback", arguments);
    }
    function bindGlobalKeyboardShortcuts() {
        return callAudioRadio("bindGlobalKeyboardShortcuts", arguments);
    }
    function clearRadioQueue() {
        return callAudioRadio("clearRadioQueue", arguments);
    }
    function syncRadioQueueToPlaylist() {
        return callAudioRadio("syncRadioQueueToPlaylist", arguments);
    }
    function ensureRadioQueue() {
        return callAudioRadio("ensureRadioQueue", arguments);
    }
    function injectCurrentTrackIntoRadioQueue() {
        return callAudioRadio("injectCurrentTrackIntoRadioQueue", arguments);
    }
    function ensureRadioPlaylistForNavigation() {
        return callAudioRadio("ensureRadioPlaylistForNavigation", arguments);
    }
    function setHomePlayMode() {
        return callAudioRadio("setHomePlayMode", arguments);
    }
    function toggleRadioModeFromTransport() {
        return callAudioRadio("toggleRadioModeFromTransport", arguments);
    }
    function toggleAlbumShuffleMode() {
        return callAudioRadio("toggleAlbumShuffleMode", arguments);
    }
    function cleanupIdleAudioContext() {
        return callAudioRadio("cleanupIdleAudioContext", arguments);
    }
    function resetHomePlaybackModeIfIdle() {
        return callAudioRadio("resetHomePlaybackModeIfIdle", arguments);
    }
    function cleanupForeignAlbumAudioWhenIdle() {
        return callAudioRadio("cleanupForeignAlbumAudioWhenIdle", arguments);
    }
    function getQuickActions() {
        return catalogState.quickActions.length ? catalogState.quickActions.slice() : (catalog = sanitizeCatalog(fallbackCatalog),
        catalogLoaderApi.buildQuickActions(catalog));
        var catalog;
    }
    async function hydrateHomeCatalog() {
        return homeCatalogApi.hydrateHomeCatalog();
    }
    function shouldInitAudioFeatures() {
        if (document.querySelector(".track-player")) return !0;
        const persistRoot = document.getElementById("infraSpaPersist");
        if (persistRoot && (persistRoot.querySelector("audio") || persistRoot.querySelector(".global-transport"))) return !0;
        try {
            if (sessionStorage.getItem(audioState.resumeStorageKey)) return !0;
        } catch (_err) {}
        return !1;
    }
    function isAdminModeEnabled() {
        try {
            return "1" === new URLSearchParams(window.location.search || "").get("edit");
        } catch (_err) {
            return !1;
        }
    }
    function isDarkColor(color) {
        const match = String(color || "").trim().match(/^#([0-9a-f]{6})$/i);
        if (!match) return !1;
        const value = match[1];
        return (299 * parseInt(value.slice(0, 2), 16) + 587 * parseInt(value.slice(2, 4), 16) + 114 * parseInt(value.slice(4, 6), 16)) / 1e3 < 128;
    }
    function scheduleDeferredServiceWorkerReload(delayMs) {
        return pwaRuntimeApi.scheduleDeferredServiceWorkerReload(delayMs);
    }
    function isIosDevice() {
        const ua = String(navigator.userAgent || "");
        if (/iPhone|iPad|iPod/i.test(ua)) return !0;
        const platform = String(navigator.platform || ""), maxTouchPoints = Number(navigator.maxTouchPoints || 0);
        return "MacIntel" === platform && maxTouchPoints > 1;
    }
    function isAndroidDevice() {
        const ua = String(navigator.userAgent || "");
        return /Android/i.test(ua);
    }
    function isStandaloneDisplayMode() {
        const mediaStandalone = "function" == typeof window.matchMedia && window.matchMedia("(display-mode: standalone)").matches, legacyStandalone = "boolean" == typeof navigator.standalone && navigator.standalone;
        return Boolean(mediaStandalone || legacyStandalone);
    }
    function isMobilePwaCoverNavigation() {
        if (!isStandaloneDisplayMode()) return !1;
        const mobileDevice = isIosDevice() || isAndroidDevice(), mobileViewport = "function" == typeof window.matchMedia ? window.matchMedia("(max-width: 980px)").matches : window.innerWidth <= 980;
        return Boolean(mobileDevice || mobileViewport);
    }
    function initPwaInstallPrompt(adminMode) {
        return pwaInstallApi.initPwaInstallPrompt(adminMode);
    }
    function toAbsoluteUrl(urlLike) {
        try {
            return new URL(String(urlLike || ""), window.location.href).href;
        } catch (_err) {
            return String(urlLike || "");
        }
    }
    function toAbsoluteUrlOrEmpty(urlLike) {
        const raw = String(urlLike || "").trim();
        return raw ? toAbsoluteUrl(raw) : "";
    }
    function toRuntimeAbsoluteUrl(urlLike) {
        try {
            return new URL(String(urlLike || ""), runtime.baseUrl).href;
        } catch (_err) {
            return toAbsoluteUrlOrEmpty(urlLike || "");
        }
    }
    function getAudioAssetPath(urlLike, baseUrl) {
        const raw = String(urlLike || "").trim();
        if (!raw) return "";
        let parsed = null;
        try {
            parsed = new URL(raw, baseUrl || window.location.href);
        } catch (_err) {
            return "";
        }
        let basePath = "/";
        try {
            basePath = new URL(".", runtime.baseUrl).pathname || "/";
        } catch (_err) {
            basePath = "/";
        }
        basePath.endsWith("/") || (basePath += "/");
        let pathname = parsed.pathname || "";
        pathname = pathname.startsWith(basePath) ? pathname.slice(basePath.length) : pathname.replace(/^\/+/, "");
        try {
            pathname = decodeURIComponent(pathname);
        } catch (_err) {}
        const assetPath = pathname.replace(/^\/+/, "");
        return /^(?:assets\/music\/streams\/|assets\/audio\/).+\.(?:mp3|m4a|aac|wav|flac|ogg)$/i.test(assetPath) ? assetPath : "";
    }
    function getAudioAssetPathKey(urlLike, baseUrl) {
        const path = getAudioAssetPath(urlLike, baseUrl || window.location.href);
        return path ? path.normalize("NFC") : "";
    }
    function resolveManagedAudioSrc(urlLike, baseUrl) {
        const raw = String(urlLike || "").trim();
        if (!raw) return "";
        const assetPath = getAudioAssetPath(raw, baseUrl || window.location.href);
        if (assetPath) try {
            return new URL(function(assetPath) {
                return String(assetPath || "").split("/").map(part => encodeURIComponent(part)).join("/");
            }(assetPath), `${AUDIO_BASE.replace(/\/+$/, "")}/`).href;
        } catch (_err) {
            return raw;
        }
        return raw;
    }
    function normalizeUrlAgainstBase(urlLike, baseUrl) {
        const raw = String(urlLike || "").trim();
        if (!raw) return "";
        try {
            return new URL(raw, baseUrl || window.location.href).href;
        } catch (_err) {
            return toAbsoluteUrlOrEmpty(raw);
        }
    }
    function normalizeSrcValue(value) {
        return String(value || "").trim();
    }
    function extractFilenameFromSrc(value) {
        const raw = normalizeSrcValue(value);
        if (!raw) return "";
        try {
            const url = new URL(raw, window.location.href), parts = decodeURIComponent(url.pathname || "").split("/");
            return String(parts[parts.length - 1] || "").toLowerCase();
        } catch (_err) {
            const parts = decodeURIComponent(raw.split("?")[0].split("#")[0]).split("/");
            return String(parts[parts.length - 1] || "").toLowerCase();
        }
    }
    function buildSrcTokens(value) {
        const raw = normalizeSrcValue(value);
        if (!raw) return [];
        const tokens = new Set;
        tokens.add(raw), tokens.add(raw.toLowerCase());
        try {
            const url = new URL(raw, window.location.href), href = String(url.href || "").trim(), pathname = String(url.pathname || "").trim(), decodedPath = decodeURIComponent(pathname || ""), pathWithSearch = `${pathname}${url.search || ""}`, decodedWithSearch = `${decodedPath}${url.search || ""}`;
            [ href, decodeURIComponent(href), pathname, decodedPath, pathWithSearch, decodedWithSearch ].forEach(token => {
                const normalized = String(token || "").trim();
                normalized && (tokens.add(normalized), tokens.add(normalized.toLowerCase()));
            });
        } catch (_err) {
            const plain = raw.split("#")[0], noQuery = plain.split("?")[0];
            [ plain, noQuery, decodeURIComponent(plain), decodeURIComponent(noQuery) ].forEach(token => {
                const normalized = String(token || "").trim();
                normalized && (tokens.add(normalized), tokens.add(normalized.toLowerCase()));
            });
        }
        const file = extractFilenameFromSrc(raw);
        return file && tokens.add(file), Array.from(tokens).filter(Boolean);
    }
    function srcMatches(a, b) {
        const left = normalizeSrcValue(a), right = normalizeSrcValue(b);
        if (!left || !right) return !1;
        if (left === right) return !0;
        const leftTokens = buildSrcTokens(left), rightSet = new Set(buildSrcTokens(right));
        if (leftTokens.some(token => rightSet.has(token))) return !0;
        for (const lt of leftTokens) for (const rt of rightSet) if (lt && rt && (lt.endsWith(rt) || rt.endsWith(lt))) return !0;
        return !1;
    }
    function hashString(value) {
        const text = String(value || "");
        let hash = 2166136261;
        for (let index = 0; index < text.length; index += 1) hash ^= text.charCodeAt(index),
        hash = Math.imul(hash, 16777619);
        return hash >>> 0;
    }
    function registerTrackFailure(srcLike) {
        const key = toAbsoluteUrlOrEmpty(srcLike || "");
        if (!key) return 0;
        const failures = (audioState.trackFailureCounts.get(key) || 0) + 1;
        if (audioState.trackFailureCounts.set(key, failures), audioState.trackFailureCounts.size > 96) {
            const firstKey = audioState.trackFailureCounts.keys().next();
            !firstKey.done && firstKey.value && audioState.trackFailureCounts.delete(firstKey.value);
        }
        return failures;
    }
    function clearTrackFailure(srcLike) {
        const key = toAbsoluteUrlOrEmpty(srcLike || "");
        key && audioState.trackFailureCounts.delete(key);
    }
    function clearTrackFailureForCurrent() {
        clearTrackFailure(getCurrentLogicalAudioSrc());
    }
    function loadMediaElementForPlayback(mediaEl) {
        if (!mediaEl) return !1;
        try {
            return mediaEl.load(), !0;
        } catch (_err) {
            return !1;
        }
    }
    function normalizeAudioSourceUrl(rawUrl) {
        const raw = resolveManagedAudioSrc(rawUrl || "", window.location.href);
        if (!raw) return "";
        let parsed = null;
        try {
            parsed = new URL(raw, window.location.href);
        } catch (_err) {
            return raw;
        }
        const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
        return "drive.google.com" === host || "docs.google.com" === host || "drive.usercontent.google.com" === host ? normalizeDownloadUrl(parsed.href) : parsed.href;
    }
    function isBlobObjectUrl(value) {
        return /^blob:/i.test(String(value || "").trim());
    }
    function getCurrentPlayableAudioSrc(audio) {
        const currentAudio = audio || audioState.audio;
        return currentAudio && (currentAudio.currentSrc || currentAudio.src) || "";
    }
    function getCurrentLogicalAudioSrc() {
        const logical = toAbsoluteUrlOrEmpty(audioState.activeLogicalSrc || "");
        if (logical && !isBlobObjectUrl(logical)) return logical;
        const currentAudio = audioState.audio;
        if (currentAudio && !currentAudio.getAttribute("src")) return "";
        const playable = getCurrentPlayableAudioSrc();
        return !playable || isBlobObjectUrl(playable) ? "" : toAbsoluteUrlOrEmpty(playable);
    }
    function revokeActiveBlobUrl() {
        if (audioState.activeBlobUrl) {
            try {
                URL.revokeObjectURL(audioState.activeBlobUrl);
            } catch (_err) {}
            audioState.activeBlobUrl = "";
        }
    }
    function setTrackStatus(track, message, options) {
        if (!track || !track.statusEl) return;
        const opts = options || {};
        track.statusText.textContent = message || "", track.retryBtn.hidden = !opts.retry,
        track.statusEl.hidden = !message, track.row.classList.toggle("has-audio-status", Boolean(message)),
        audioState.activeStatusTrack = message ? track : null;
    }
    function clearTrackStatus(track) {
        track && (setTrackStatus(track, ""), audioState.activeStatusTrack === track && (audioState.activeStatusTrack = null));
    }
    function clearOtherTrackStatuses(track) {
        const ui = audioState.ui;
        ui && Array.isArray(ui.tracks) && ui.tracks.forEach(function(item) {
            item !== track && clearTrackStatus(item);
        });
    }
    function getTrackByIndex(index) {
        const ui = audioState.ui;
        return ui && Array.isArray(ui.tracks) ? !Number.isInteger(index) || index < 0 || index >= ui.tracks.length ? null : ui.tracks[index] : null;
    }
    function normalizeTrackTitle(title) {
        const raw = String(title || "").trim(), cleaned = /^\d+\s+[a-z]\s+\d+$/i.test(raw) ? raw : raw.replace(/^0*\d{1,2}\s+/, "").trim();
        return cleaned ? cleaned.toLocaleUpperCase() : "";
    }
    function normalizeAlbumTitle(title) {
        return String(title || "").replace(/\s+/g, " ").trim().toLocaleUpperCase();
    }
    function displayAlbumCardTitle(title) {
        const cleaned = String(title || "").replace(/\s+/g, " ").trim();
        return cleaned ? /[\u0370-\u03ff]/u.test(cleaned) || /\b[A-Z][a-z]\b/.test(cleaned) ? cleaned : cleaned.toLocaleUpperCase() : "";
    }
    function getCurrentAlbumTitle() {
        if (!document.body.classList.contains("album-screen")) return "";
        const heading = document.querySelector(".album-layout h1") || document.querySelector(".album-hero h1") || document.querySelector("main h1") || document.querySelector("h1");
        return normalizeAlbumTitle(heading ? heading.textContent : "");
    }
    function getCurrentPlaylistTrack() {
        const list = Array.isArray(audioState.playlist) ? audioState.playlist : [];
        if (!list.length) return null;
        const currentSrc = getCurrentLogicalAudioSrc();
        if (currentSrc) {
            const bySrc = list.find(track => track && srcMatches(track.src, currentSrc));
            if (bySrc) return mergeTrackMetadata(bySrc);
        }
        return audioState.currentIndex >= 0 && audioState.currentIndex < list.length ? mergeTrackMetadata(list[audioState.currentIndex] || null) : null;
    }
    function getCurrentTrackAlbumPage(track) {
        const enriched = mergeTrackMetadata(track || null), page = enriched && enriched.page ? String(enriched.page).trim() : "";
        return page ? toAbsoluteUrl(page) : document.body.classList.contains("album-screen") ? toAbsoluteUrl(window.location.pathname) : "";
    }
    function getCurrentTrackArtwork(track) {
        return resolveCoverUrl(track || null, {
            width: 900
        }) || getMediaSessionFallbackArtwork();
    }
    function preloadImage(src, options) {
        const url = toAbsoluteUrlOrEmpty(src || ""), opts = options || {};
        return url && "function" == typeof Image ? new Promise(function(resolve) {
            const image = new Image;
            let settled = !1;
            function done(ok) {
                settled || (settled = !0, image.onload = null, image.onerror = null, resolve({
                    ok: Boolean(ok),
                    src: url
                }));
            }
            try {
                image.decoding = "async";
            } catch (_err) {}
            if (opts.highPriority) try {
                image.fetchPriority = "high";
            } catch (_err) {}
            image.onload = function() {
                "function" != typeof image.decode ? done(!0) : image.decode().then(function() {
                    done(!0);
                }, function() {
                    done(!0);
                });
            }, image.onerror = function() {
                done(!1);
            }, image.src = url, image.complete && image.naturalWidth > 0 && ("function" == typeof image.decode ? image.decode().then(function() {
                done(!0);
            }, function() {
                done(!0);
            }) : done(!0));
        }) : Promise.resolve({
            ok: !1,
            src: url
        });
    }
    function setCoverWhenReady(imgElement, nextSrc, fallbackSrc, token) {
        if (!imgElement) return Promise.resolve(!1);
        const fallback = normalizeCoverUrl(fallbackSrc || "", {
            responsive: !1
        }) || getCurrentTrackArtwork(null), target = normalizeCoverUrl(nextSrc || "", {
            width: 900
        }) || fallback;
        if (!target) return Promise.resolve(!1);
        const current = toAbsoluteUrlOrEmpty(imgElement.currentSrc || imgElement.src || "");
        if (current && srcMatches(current, target)) return Promise.resolve(!0);
        const track = getCurrentPlaylistTrack(), trackPath = getAudioAssetPath(track && track.src ? track.src : getCurrentLogicalAudioSrc(), window.location.href);
        if (!trackPath && srcMatches(target, getMediaSessionFallbackArtwork())) return Promise.resolve(!1);
        function isFresh() {
            return !Number.isInteger(token) || token === audioState.coverUpdateToken;
        }
        const coverStartedAt = getAudioTelemetryNow();
        return logCoverRuntimeEvent("cover_request", {
            album: normalizeAlbumTitle(track && track.album ? track.album : getCurrentAlbumTitle()),
            source: getCoverTelemetrySource(target, track),
            cover_url: target,
            fallback_url: fallback || "",
            track_path: trackPath
        }), preloadImage(target, {
            highPriority: !0
        }).then(function(result) {
            if (!isFresh()) return !1;
            if (result && result.ok) return trackAudioRuntimeEvent("cover_loaded", Object.assign({
                album: normalizeAlbumTitle(track && track.album ? track.album : getCurrentAlbumTitle()),
                source: getCoverTelemetrySource(target, track),
                cover_url: target,
                duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - coverStartedAt)),
                track_path: trackPath
            }, getResourceTimingHint(target, coverStartedAt))), imgElement.src = target, !0;
            if (trackAudioRuntimeEvent("cover_error", {
                album: normalizeAlbumTitle(track && track.album ? track.album : getCurrentAlbumTitle()),
                source: getCoverTelemetrySource(target, track),
                cover_url: target,
                duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - coverStartedAt)),
                track_path: trackPath
            }), !fallback || srcMatches(target, fallback)) return !1;
            const fallbackStartedAt = getAudioTelemetryNow();
            return logCoverRuntimeEvent("cover_request", {
                album: normalizeAlbumTitle(track && track.album ? track.album : getCurrentAlbumTitle()),
                source: "fallback",
                cover_url: fallback,
                failed_cover_url: target,
                track_path: trackPath
            }), preloadImage(fallback, {
                highPriority: !0
            }).then(function(fallbackResult) {
                return !!isFresh() && (fallbackResult && fallbackResult.ok ? (trackAudioRuntimeEvent("cover_loaded", Object.assign({
                    album: normalizeAlbumTitle(track && track.album ? track.album : getCurrentAlbumTitle()),
                    source: "fallback",
                    cover_url: fallback,
                    duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - fallbackStartedAt)),
                    track_path: trackPath
                }, getResourceTimingHint(fallback, fallbackStartedAt))), imgElement.src = fallback,
                !0) : (trackAudioRuntimeEvent("cover_error", {
                    album: normalizeAlbumTitle(track && track.album ? track.album : getCurrentAlbumTitle()),
                    source: "fallback",
                    cover_url: fallback,
                    duration_ms: Math.max(0, Math.round(getAudioTelemetryNow() - fallbackStartedAt)),
                    track_path: trackPath
                }), !1));
            });
        });
    }
    function setCoverBackgroundStable(element, nextSrc, fallbackSrc, token) {
        if (!element) return Promise.resolve(!1);
        const fallback = normalizeCoverUrl(fallbackSrc || "", {
            responsive: !1
        }) || getMediaSessionFallbackArtwork(), target = normalizeCoverUrl(nextSrc || "", {
            width: 900
        }) || fallback;
        if (!target) return Promise.resolve(!1);
        const current = String(element.dataset.coverBgUrl || "").trim();
        if (current && srcMatches(current, target)) return Promise.resolve(!0);
        return preloadImage(target, {
            highPriority: !0
        }).then(function(result) {
            if (Number.isInteger(token) && token !== audioState.coverUpdateToken) return !1;
            const chosen = result && result.ok ? target : fallback;
            return !!chosen && (element.style.backgroundImage = `url("${chosen.replace(/"/g, "%22")}")`,
            element.dataset.coverBgUrl = chosen, !0);
        });
    }
    function resolveCatalogAlbumArtwork(track) {
        const page = toAbsoluteUrlOrEmpty(track && track.page ? track.page : ""), album = normalizeAlbumTitle(track && track.album ? track.album : ""), catalog = catalogState.data && Array.isArray(catalogState.data.albums) ? catalogState.data : fallbackCatalog, albums = Array.isArray(catalog && catalog.albums) ? catalog.albums : [];
        if (!albums.length) return "";
        let matched = null;
        page && (matched = albums.find(entry => toAbsoluteUrlOrEmpty(entry && entry.page ? entry.page : "") === page) || null),
        !matched && album && (matched = albums.find(entry => normalizeAlbumTitle(entry && entry.title ? entry.title : "") === album) || null);
        return (matched && matched.thumb ? toRuntimeAbsoluteUrl(matched.thumb) : "") || "";
    }
    function resolveTracksAlbumArtwork(track) {
        const meta = getTrackMetaByAssetPath(track && track.src ? track.src : "");
        if (meta && meta.artwork) return meta.artwork;
        const tracksData = audioState.tracksData, albums = Array.isArray(tracksData && tracksData.albums) ? tracksData.albums : [];
        if (!albums.length) return "";
        const page = toAbsoluteUrlOrEmpty(track && track.page ? track.page : ""), album = normalizeAlbumTitle(track && track.album ? track.album : "");
        let matched = null;
        return page && (matched = albums.find(function(entry) {
            return toRuntimeAbsoluteUrl(entry && entry.page ? entry.page : "") === page;
        }) || null), !matched && album && (matched = albums.find(function(entry) {
            return normalizeAlbumTitle(entry && entry.title ? entry.title : "") === album;
        }) || null), matched && matched.cover ? toRuntimeAbsoluteUrl(matched.cover) : "";
    }
    function normalizeAlbumContinuityPage(pageLike) {
        const raw = String(pageLike || "").trim();
        if (!raw) return "";
        let href = "";
        try {
            href = new URL(raw, runtime.baseUrl).href;
        } catch (_err) {
            href = toAbsoluteUrlOrEmpty(raw);
        }
        if (!href) return "";
        try {
            const url = new URL(href);
            return url.hash = "", url.search = "", url.href.replace(/\/index\.html$/i, "/");
        } catch (_err) {
            return href.split("#")[0].split("?")[0].replace(/\/index\.html$/i, "/");
        }
    }
    function findTracksAlbumByCatalogEntry(catalogEntry, tracksAlbums) {
        if (!catalogEntry) return null;
        const catalogPage = normalizeAlbumContinuityPage(catalogEntry.page || ""), catalogTitle = normalizeAlbumTitle(catalogEntry.title || "");
        if (catalogPage) {
            const byPage = tracksAlbums.find(function(album) {
                return normalizeAlbumContinuityPage(album && album.page ? album.page : "") === catalogPage;
            });
            if (byPage) return byPage;
        }
        return catalogTitle && tracksAlbums.find(function(album) {
            return normalizeAlbumTitle(album && album.title ? album.title : "") === catalogTitle;
        }) || null;
    }
    function findNextAlbumForContinuity(currentAlbum, tracksAlbums) {
        if (!currentAlbum || tracksAlbums.length < 2) return null;
        const catalogAlbums = function() {
            const catalog = catalogState.data && Array.isArray(catalogState.data.albums) ? catalogState.data : fallbackCatalog;
            return Array.isArray(catalog && catalog.albums) ? catalog.albums : [];
        }(), currentPage = normalizeAlbumContinuityPage(currentAlbum.page || ""), currentTitle = normalizeAlbumTitle(currentAlbum.title || ""), catalogIndex = catalogAlbums.findIndex(function(entry) {
            const entryPage = normalizeAlbumContinuityPage(entry && entry.page ? entry.page : ""), entryTitle = normalizeAlbumTitle(entry && entry.title ? entry.title : "");
            return currentPage && entryPage === currentPage || currentTitle && entryTitle === currentTitle;
        });
        if (catalogIndex >= 0 && catalogAlbums.length > 1) for (let offset = 1; offset <= catalogAlbums.length; offset += 1) {
            const candidateCatalog = catalogAlbums[(catalogIndex + offset) % catalogAlbums.length], candidateAlbum = findTracksAlbumByCatalogEntry(candidateCatalog, tracksAlbums);
            if (candidateAlbum && candidateAlbum !== currentAlbum) return {
                album: candidateAlbum,
                catalog: candidateCatalog || null,
                wrapped: catalogIndex + offset >= catalogAlbums.length
            };
        }
        const tracksIndex = tracksAlbums.indexOf(currentAlbum);
        if (tracksIndex < 0) return null;
        for (let offset = 1; offset <= tracksAlbums.length; offset += 1) {
            const candidateAlbum = tracksAlbums[(tracksIndex + offset) % tracksAlbums.length];
            if (candidateAlbum && candidateAlbum !== currentAlbum) return {
                album: candidateAlbum,
                catalog: null,
                wrapped: tracksIndex + offset >= tracksAlbums.length
            };
        }
        return null;
    }
    function extendAlbumPlaylistToNextAlbum(options) {
        const list = Array.isArray(audioState.playlist) ? audioState.playlist : [], currentIndex = Number.isInteger(audioState.currentIndex) ? audioState.currentIndex : -1;
        if (!list.length || currentIndex < 0 || currentIndex < list.length - 1) return -1;
        if ("radio" === audioState.homeMode || audioState.shuffleOn) return -1;
        if ("global" === audioState.playlistKind || "favorites" === audioState.playlistKind) return -1;
        if (String(audioState.playlistToken || "").startsWith("manual-")) return -1;
        const tracksAlbums = function() {
            const tracksData = audioState.tracksData;
            return (Array.isArray(tracksData && tracksData.albums) ? tracksData.albums : []).filter(function(album) {
                return album && Array.isArray(album.tracks) && album.tracks.some(function(track) {
                    return track && track.src;
                });
            });
        }();
        if (!tracksAlbums.length) return loadTracksData().catch(function() {}), -1;
        const currentAlbum = function(track, tracksAlbums) {
            const enriched = mergeTrackMetadata(track || null), page = normalizeAlbumContinuityPage(enriched && enriched.page ? enriched.page : track && track.page ? track.page : ""), albumTitle = normalizeAlbumTitle(enriched && enriched.album ? enriched.album : track && track.album ? track.album : "");
            if (page) {
                const byPage = tracksAlbums.find(function(album) {
                    return normalizeAlbumContinuityPage(album && album.page ? album.page : "") === page;
                });
                if (byPage) return byPage;
            }
            if (albumTitle) {
                const byTitle = tracksAlbums.find(function(album) {
                    return normalizeAlbumTitle(album && album.title ? album.title : "") === albumTitle;
                });
                if (byTitle) return byTitle;
            }
            const src = track && track.src || getCurrentLogicalAudioSrc();
            return src && tracksAlbums.find(function(album) {
                return (Array.isArray(album && album.tracks) ? album.tracks : []).some(function(candidate) {
                    return candidate && candidate.src && srcMatches(candidate.src, src);
                });
            }) || null;
        }(list[currentIndex], tracksAlbums), nextAlbum = findNextAlbumForContinuity(currentAlbum, tracksAlbums);
        if (!nextAlbum || !nextAlbum.album) return -1;
        const nextTracks = nextAlbum.album.tracks.map(function(track) {
            return function(track, album, catalogEntry) {
                if (!track || !track.src || !album) return null;
                const src = resolveManagedAudioSrc(track.src, runtime.baseUrl.href);
                if (!src) return null;
                const seconds = Number(track.seconds), duration = String(track.duration || "").trim() || formatTrackDuration(seconds), albumTitle = normalizeAlbumTitle(album.title || catalogEntry && catalogEntry.title || ""), page = toRuntimeAbsoluteUrl(album.page || catalogEntry && catalogEntry.page || ""), artwork = album.cover ? toRuntimeAbsoluteUrl(album.cover) : catalogEntry && catalogEntry.thumb ? toRuntimeAbsoluteUrl(catalogEntry.thumb) : "";
                return {
                    src: src,
                    name: normalizeTrackTitle(track.title || track.name || ""),
                    album: albumTitle,
                    page: page,
                    artist: "INFRA.",
                    artwork: artwork,
                    duration: duration,
                    seconds: seconds
                };
            }(track, nextAlbum.album, nextAlbum.catalog);
        }).filter(Boolean);
        if (!nextTracks.length) return -1;
        const duplicateIndex = list.findIndex(function(existing, index) {
            return !(index <= currentIndex || !existing || !existing.src) && nextTracks.some(function(track) {
                return track && track.src && srcMatches(existing.src, track.src);
            });
        });
        if (duplicateIndex > currentIndex) return duplicateIndex;
        const firstNextIndex = list.length;
        return audioState.playlist = list.concat(nextTracks), audioState.playlistKind = "album",
        syncPlaylistContext(audioState.playlist, {
            preserveRecent: !0
        }), trackAudioRuntimeEvent("album_continuity_extend", {
            from_index: currentIndex,
            to_index: firstNextIndex,
            from_album: normalizeAlbumTitle(currentAlbum && currentAlbum.title ? currentAlbum.title : ""),
            to_album: normalizeAlbumTitle(nextAlbum.album.title || ""),
            appended_count: nextTracks.length,
            wrapped: Boolean(nextAlbum.wrapped),
            reason: options && options.reason ? String(options.reason) : ""
        }), firstNextIndex;
    }
    function buildPreservedTrack(track, fallbackSrc) {
        const src = toAbsoluteUrlOrEmpty(track && track.src ? track.src : fallbackSrc || "");
        return src ? {
            src: src,
            name: normalizeTrackTitle(track && track.name ? track.name : ""),
            album: normalizeAlbumTitle(track && track.album ? track.album : getCurrentAlbumTitle()),
            page: getCurrentTrackAlbumPage(track || null),
            artist: track && track.artist ? track.artist : "INFRA.",
            artwork: getCurrentTrackArtwork(track || null),
            duration: String(track && track.duration ? track.duration : "").trim(),
            seconds: Number(track && track.seconds)
        } : null;
    }
    function savePlaybackQueueContext() {
        return callAudioRadio("savePlaybackQueueContext", arguments);
    }
    function seekCurrentAudioToRatio(ratio) {
        return audioCoreApi.seekCurrentAudioToRatio(ratio);
    }
    function parseSrcsetCandidates() {
        return mediaSessionRuntimeApi.parseSrcsetCandidates.apply(mediaSessionRuntimeApi, arguments);
    }
    function choosePreferredSrcsetSource() {
        return mediaSessionRuntimeApi.choosePreferredSrcsetSource.apply(mediaSessionRuntimeApi, arguments);
    }
    function getAlbumCoverFromDoc() {
        return mediaSessionRuntimeApi.getAlbumCoverFromDoc.apply(mediaSessionRuntimeApi, arguments);
    }
    function normalizeArtworkUrl() {
        return mediaSessionRuntimeApi.normalizeArtworkUrl.apply(mediaSessionRuntimeApi, arguments);
    }
    function normalizeCoverUrl() {
        return mediaSessionRuntimeApi.normalizeCoverUrl.apply(mediaSessionRuntimeApi, arguments);
    }
    function resolveCoverUrl() {
        return mediaSessionRuntimeApi.resolveCoverUrl.apply(mediaSessionRuntimeApi, arguments);
    }
    function initAudioSessionTelemetry() {
        return mediaSessionRuntimeApi.initAudioSessionTelemetry();
    }
    function bindMediaSessionActions() {
        return mediaSessionRuntimeApi.bindMediaSessionActions.apply(mediaSessionRuntimeApi, arguments);
    }
    function syncMediaSessionMetadata() {
        return mediaSessionRuntimeApi.syncMediaSessionMetadata.apply(mediaSessionRuntimeApi, arguments);
    }
    function scheduleMediaSessionResync() {
        return mediaSessionRuntimeApi.scheduleMediaSessionResync.apply(mediaSessionRuntimeApi, arguments);
    }
    function clearWaitingRecovery() {
        return mediaSessionRuntimeApi.clearWaitingRecovery();
    }
    function scheduleWaitingRecovery() {
        return mediaSessionRuntimeApi.scheduleWaitingRecovery.apply(mediaSessionRuntimeApi, arguments);
    }
    function isCloudflareAudioUrl(urlValue) {
        try {
            return new URL(String(urlValue || ""), window.location.href).origin === new URL(AUDIO_BASE).origin;
        } catch (_err) {
            return !1;
        }
    }
    function getAudioSource(resolvedUrl) {
        const raw = String(resolvedUrl || "").trim();
        if (!raw) return "github";
        if (isCloudflareAudioUrl(raw) || /\.r2\.dev(?:\/|$)/i.test(raw)) return "r2dev";
        try {
            return new URL(raw, window.location.href).origin === window.location.origin ? "github" : "other";
        } catch (_err) {
            return "github";
        }
    }
    function getAudioMonitorTrackLabel(track, index) {
        const title = track && track.name ? String(track.name).trim() : "";
        if (title) return title;
        const src = track && track.src ? String(track.src).split("/").pop() : "";
        return src || (Number.isInteger(index) && index >= 0 ? `track-${index + 1}` : "unknown");
    }
    function buildAudioMonitorPayload(track, index, src) {
        const resolvedSrc = src || (track && track.src ? track.src : getCurrentLogicalAudioSrc()), trackPath = getAudioAssetPath(resolvedSrc || (track && track.src ? track.src : ""), window.location.href);
        return {
            track: getAudioMonitorTrackLabel(track, index),
            album: normalizeAlbumTitle(track && track.album ? track.album : getCurrentAlbumTitle()),
            track_path: trackPath,
            source: getAudioSource(resolvedSrc),
            src: resolvedSrc || ""
        };
    }
    function getAudioRuntimeProbeState() {
        return audioTelemetryApi.getRuntimeProbeState();
    }
    function getAudioBufferedEnd() {
        return "function" == typeof audioTelemetryApi.getBufferedEnd ? audioTelemetryApi.getBufferedEnd() : null;
    }
    function flushAudioTelemetryQueue(options) {
        return audioTelemetryApi.flushQueue(options);
    }
    function startAudioTelemetryHeartbeat() {
        audioTelemetryApi.startHeartbeat();
    }
    function stopAudioTelemetryHeartbeat() {
        audioTelemetryApi.stopHeartbeat();
    }
    function markAudioTelemetryInactive() {
        audioTelemetryApi.markHealthSessionInactive();
    }
    function clearActiveAudioRecovery() {
        const recovery = audioState.activeAudioRecovery;
        recovery && recovery.timer && window.clearTimeout(recovery.timer), audioState.activeAudioRecovery = null;
    }
    function buildAudioRecoveryPayload(recovery, extra) {
        const audio = audioState.audio;
        return Object.assign(buildAudioMonitorPayload(getCurrentPlaylistTrack(), audioState.currentIndex, audioState.activeLogicalSrc || audio && (audio.currentSrc || audio.src) || ""), getAudioRuntimeProbeState(), {
            request_token: recovery && recovery.requestToken,
            reason: recovery && recovery.reason,
            strategy: recovery && recovery.strategy,
            recovery_ms: recovery ? Math.max(0, Date.now() - recovery.startedAt) : 0
        }, extra || {});
    }
    function beginAudioRecovery(details) {
        const source = details || {}, requestToken = Number(source.request_token);
        if (!Number.isFinite(requestToken) || requestToken !== audioState.startRequestToken) return;
        const existing = audioState.activeAudioRecovery;
        if (existing && existing.requestToken === requestToken) return existing.reason = source.reason || existing.reason,
        void (existing.strategy = source.strategy || existing.strategy);
        clearActiveAudioRecovery();
        const audio = audioState.audio, recovery = {
            requestToken: requestToken,
            reason: String(source.reason || "playback_failure"),
            strategy: String(source.strategy || "retry"),
            startedAt: Date.now(),
            startTime: audio && Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
            timer: null
        };
        audioState.activeAudioRecovery = recovery, trackAudioRuntimeEvent("recovery_start", buildAudioRecoveryPayload(recovery)),
        recovery.timer = window.setTimeout(function() {
            audioState.activeAudioRecovery === recovery && failAudioRecovery({
                request_token: requestToken,
                reason: "progress_timeout",
                strategy: recovery.strategy
            });
        }, 7e3);
    }
    function confirmAudioRecovery(audio) {
        const recovery = audioState.activeAudioRecovery;
        if (!recovery) return;
        if (recovery.requestToken !== audioState.startRequestToken) return void clearActiveAudioRecovery();
        if (!audio || audio.paused || !Number.isFinite(audio.currentTime)) return;
        const advanced = Math.max(0, audio.currentTime - recovery.startTime);
        advanced < .2 || (trackAudioRuntimeEvent("recovery_resolved", buildAudioRecoveryPayload(recovery, {
            advanced_ms: Math.round(1e3 * advanced),
            paused: !1
        })), clearActiveAudioRecovery());
    }
    function failAudioRecovery(details) {
        const source = details || {}, recovery = audioState.activeAudioRecovery;
        if (!recovery) return;
        const requestToken = Number(source.request_token);
        Number.isFinite(requestToken) && requestToken !== recovery.requestToken || (recovery.reason = String(source.reason || recovery.reason || "recovery_failed"),
        recovery.strategy = String(source.strategy || recovery.strategy || "retry"), trackAudioRuntimeEvent("recovery_failed", buildAudioRecoveryPayload(recovery, {
            paused: Boolean(audioState.audio && audioState.audio.paused)
        })), clearActiveAudioRecovery());
    }
    function clearNextTrackPrefetch() {
        return callAudioRadio("clearNextTrackPrefetch", arguments);
    }
    function getAutoPrefetchedNextIndex() {
        return callAudioRadio("getAutoPrefetchedNextIndex", arguments);
    }
    function startNextTrackPrefetch() {
        return callAudioRadio("startNextTrackPrefetch", arguments);
    }
    function maybePrefetchNextTrack() {
        return callAudioRadio("maybePrefetchNextTrack", arguments);
    }
    function scheduleSilentCheck() {
        return callAudioRadio("scheduleSilentCheck", arguments);
    }
    function trackAudioRuntimeEvent(type, data) {
        audioTelemetryApi.trackRuntimeEvent(type, data);
    }
    function sendAudioMonitoringLog(track, index, src, data) {
        audioTelemetryApi.sendMonitoringLog(track, index, src, data);
    }
    function logAudioAuditEvent(type, track, index, src, data) {
        audioTelemetryApi.logAuditEvent(type, track, index, src, data);
    }
    function getCoverTelemetrySource(coverUrl, track) {
        const url = toAbsoluteUrlOrEmpty(coverUrl || "");
        if (!url) return "unknown";
        if (srcMatches(url, getMediaSessionFallbackArtwork())) return "fallback";
        const tracksArtwork = resolveTracksAlbumArtwork(track || null);
        if (tracksArtwork && srcMatches(url, normalizeArtworkUrl(tracksArtwork))) return "tracks.json";
        const catalogArtwork = resolveCatalogAlbumArtwork(track || null);
        if (catalogArtwork && srcMatches(url, normalizeArtworkUrl(catalogArtwork))) return "catalog";
        const domArtwork = getAlbumCoverFromDoc(document, window.location.href);
        return domArtwork && srcMatches(url, domArtwork) || /\/assets\/music\//i.test(url) ? "DOM" : "fallback";
    }
    function getAlbumNameFromUrlLike(urlLike) {
        try {
            const path = new URL(String(urlLike || ""), window.location.href).pathname.toLowerCase();
            if (path.includes("/kali-infra")) return "KALI";
            const slug = decodeURIComponent((path.split("/").pop() || "").replace(/\.html$/i, "")).replace(/-infra$/i, "");
            if (slug) return slug.replace(/-/g, " ").toUpperCase();
        } catch (_err) {}
        return "";
    }
    function logAudioRuntimeAlbumSwitch(context, cached) {
        if (!context || !context.startedAt) return;
        const track = getCurrentPlaylistTrack();
        trackAudioRuntimeEvent("album_switch", Object.assign(buildAudioMonitorPayload(track, audioState.currentIndex, getCurrentLogicalAudioSrc()), {
            from_album: context.fromAlbum || "",
            to_album: getCurrentAlbumTitle() || document.title || "",
            from_url: context.fromUrl || "",
            to_url: context.toUrl || "",
            delay_ms: Date.now() - context.startedAt,
            cached: Boolean(cached)
        }));
    }
    function clearFadeTimer() {
        if (audioState.fadeTimer && (clearInterval(audioState.fadeTimer), audioState.fadeTimer = null),
        audioState.fadeResolve) {
            const resolve = audioState.fadeResolve;
            audioState.fadeResolve = null, resolve(!1);
        }
    }
    function fadeInAudio(audio, durationMs) {
        if (!audio) return;
        if (isIosDevice()) {
            try {
                audio.volume = 1;
            } catch (_e) {}
            return;
        }
        clearFadeTimer();
        const duration = Math.max(90, Number(durationMs) || 120), stepMs = Math.max(16, Math.round(duration / 6));
        let step = 0;
        try {
            audio.volume = 0;
        } catch (_err) {
            return;
        }
        audioState.fadeTimer = setInterval(function() {
            step += 1;
            const nextVolume = Math.min(1, step / 6);
            try {
                audio.volume = nextVolume;
            } catch (_err) {
                return void clearFadeTimer();
            }
            if (step >= 6 || audio.paused) {
                clearFadeTimer();
                try {
                    audio.volume = 1;
                } catch (_err) {}
            }
        }, stepMs);
    }
    function forceAudioFullVolume(audio) {
        if (clearFadeTimer(), audio) try {
            audio.volume = 1;
        } catch (_err) {}
    }
    function fadeOutAudio(audio, durationMs, requestToken) {
        return new Promise(function(resolve) {
            if (!audio || requestToken !== audioState.startRequestToken) return void resolve(!1);
            if (isIosDevice()) {
                try {
                    audio.volume = 1;
                } catch (_e) {}
                return void resolve(!0);
            }
            clearFadeTimer();
            const duration = Math.max(80, Number(durationMs) || 100), stepMs = Math.max(16, Math.round(duration / 6));
            let step = 0, startVolume = 1;
            try {
                startVolume = Number.isFinite(audio.volume) ? audio.volume : 1;
            } catch (_err) {
                startVolume = 1;
            }
            function finish(result) {
                audioState.fadeTimer && (clearInterval(audioState.fadeTimer), audioState.fadeTimer = null),
                audioState.fadeResolve = null, resolve(Boolean(result));
            }
            audioState.fadeResolve = finish, audioState.fadeTimer = setInterval(function() {
                if (requestToken !== audioState.startRequestToken) return void finish(!1);
                step += 1;
                const nextVolume = Math.max(0, startVolume * (1 - step / 6));
                try {
                    audio.volume = nextVolume;
                } catch (_err) {}
                step >= 6 && finish(!0);
            }, stepMs);
        });
    }
    function ensureGlobalAudio() {
        return callAudioRadio("ensureGlobalAudio", arguments);
    }
    function startAudioRaf() {
        return callAudioRadio("startAudioRaf", arguments);
    }
    function updateProgressUi() {
        const audio = audioState.audio;
        if (!audio) return;
        !function() {
            callTransportUi("syncTransportMiniUi", arguments);
        }();
        const ui = audioState.ui;
        if (!ui) return;
        const src = getCurrentLogicalAudioSrc(), index = ui.tracks.findIndex(track => srcMatches(track.src, src));
        if (index < 0) return;
        const track = ui.tracks[index];
        if (!track.fill) return;
        if (!audio.duration || !Number.isFinite(audio.duration) || audio.duration <= 0) return void (track.fill.style.width = "0%");
        const percent = audio.currentTime / audio.duration * 100;
        track.fill.style.width = Math.max(0, Math.min(100, percent)) + "%";
    }
    function saveResumeState() {
        return callAudioRadio("saveResumeState", arguments);
    }
    function ensurePlayablePlaylistContext() {
        return callAudioRadio("ensurePlayablePlaylistContext", arguments);
    }
    function markAudioPauseIntent() {
        return callAudioRadio("markAudioPauseIntent", arguments);
    }
    function cancelExternalResumeCommand() {
        return callAudioRadio("cancelExternalResumeCommand", arguments);
    }
    function syncPlaylistContext(list, options) {
        return audioCoreApi.syncPlaylistContext(list, options);
    }
    function ensureCurrentIndexFromAudio() {
        return audioCoreApi.ensureCurrentIndexFromAudio();
    }
    function getCurrentPlaylistIndexSafe() {
        return audioCoreApi.getCurrentPlaylistIndexSafe();
    }
    function getQueuePreviewIndices(limit) {
        return audioCoreApi.getQueuePreviewIndices(limit);
    }
    function resetAudioElementForSource(audio, srcLike) {
        return audioCoreApi.resetAudioElementForSource(audio, srcLike);
    }
    function recoverFromTrackFailure(index, srcLike, requestToken) {
        return audioCoreApi.recoverFromTrackFailure(index, srcLike, requestToken);
    }
    function getRandomIndex(exceptIndex) {
        return audioCoreApi.getRandomIndex(exceptIndex);
    }
    function startTrack(index, options) {
        return audioCoreApi.startTrack(index, options);
    }
    function playNext(options) {
        return audioCoreApi.playNext(options);
    }
    function playPrevious(options) {
        return audioCoreApi.playPrevious(options);
    }
    function movePlaylistItem(fromIndex, toIndex, options) {
        return audioCoreApi.movePlaylistItem(fromIndex, toIndex, options);
    }
    function startRadioPlaybackFromIdle() {
        return audioCoreApi.startRadioPlaybackFromIdle();
    }
    function togglePlayPause() {
        return audioCoreApi.togglePlayPause();
    }
    function playFromExternalControl() {
        return callAudioRadio("playFromExternalControl", arguments);
    }
    function handleGlobalTransportToggle() {
        return callAudioRadio("handleGlobalTransportToggle", arguments);
    }
    function isAlbumOpenUrl(urlLike) {
        try {
            const url = new URL(String(urlLike || ""), window.location.href);
            return /\/music\/[^/]+\.html$/i.test(url.pathname);
        } catch (_err) {
            return !1;
        }
    }
    function isTelemetryTimestampBetween(value, start, end) {
        const ts = Number(value);
        return Number.isFinite(ts) && ts > 0 && ts >= start && ts <= end;
    }
    function createAlbumOpenTelemetryContext(url, rendered, opts) {
        if (!url || !isAlbumOpenUrl(url.href)) return null;
        if (!opts || "push" !== opts.history) return null;
        const context = {
            startedAt: getAudioTelemetryNow(),
            fromUrl: rendered ? rendered.href : window.location.href,
            toUrl: url.href,
            fromAlbum: getCurrentAlbumTitle() || document.title || "",
            toAlbum: getAlbumNameFromUrlLike(url.href),
            controllerchangeAtStart: pwaRuntimeApi.getControllerChangeAt(),
            reloadExecutedAtStart: pwaRuntimeApi.getReloadExecutedAt()
        };
        return trackAudioRuntimeEvent("album_open_tap", {
            track: "album_open",
            album: context.toAlbum || "",
            from_album: context.fromAlbum || "",
            to_album: context.toAlbum || "",
            from_url: context.fromUrl,
            to_url: context.toUrl,
            controllerchange: !1,
            sw_reload_between: !1
        }), context;
    }
    function finishAlbumOpenTelemetry(context, eventName, extra) {
        if (!context || !context.startedAt) return;
        const endedAt = getAudioTelemetryNow(), controllerBetween = isTelemetryTimestampBetween(pwaRuntimeApi.getControllerChangeAt(), context.startedAt, endedAt), reloadBetween = isTelemetryTimestampBetween(pwaRuntimeApi.getReloadExecutedAt(), context.startedAt, endedAt);
        trackAudioRuntimeEvent(eventName, Object.assign({
            track: "album_open",
            album: context.toAlbum || "",
            from_album: context.fromAlbum || "",
            to_album: context.toAlbum || getAlbumNameFromUrlLike(context.toUrl),
            from_url: context.fromUrl,
            to_url: context.toUrl,
            delta_ms: Math.max(0, Math.round(endedAt - context.startedAt)),
            controllerchange: controllerBetween,
            sw_reload_between: Boolean(controllerBetween || reloadBetween),
            reload_executed: reloadBetween
        }, extra || {}));
    }
    function prefetchSpaPage() {
        return spaControllerApi.prefetchSpaPage.apply(spaControllerApi, arguments);
    }
    "serviceWorker" in navigator && navigator.serviceWorker.addEventListener("message", function(event) {
        const data = event && event.data ? event.data : null;
        if (!data || "INFRA_PREFETCH_HIT" !== data.type) return;
        const src = normalizeAudioSourceUrl(data.url || "");
        src && (audioState.nextPrefetchServedSrc = src, trackAudioRuntimeEvent("served_from_prefetch", Object.assign(buildAudioMonitorPayload(getCurrentPlaylistTrack(), audioState.currentIndex, src), {
            range: Boolean(data.range),
            range_header: data.range_header || "",
            status: data.status || 200
        })));
    }), audioTelemetryApi.initLifecycle(), document.addEventListener("DOMContentLoaded", function() {
        spaControllerApi.initSpaNavigation(), pwaRuntimeApi.registerServiceWorker(), initPage();
    });
}();
