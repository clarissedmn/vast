import './App.css';
import React, {useEffect, useRef, useState} from 'react';
import {VASTClient, VASTTracker} from '@dailymotion/vast-client';
import VMAP from '@dailymotion/vmap';

const vastClient = new VASTClient();

function App() {
    const [videoSrc, setVideoSrc] = useState('');
    const [videoTime, setVideoTime] = useState(0);
    const [videoRedirectionUrl, setVideoRedirectionUrl] = useState('');
    const videoRef = useRef(null);
    const [showSkipButton, setShowSkipButton] = useState(false);
    const vastTrackerRef = useRef(null);
    const isAdPlayingRef = useRef(false);
    const [vast, setVast] = useState([])
    const VIDEO_SRC = 'https://dmplayer.storage.googleapis.com/tech_test/midnight_sun_720p.mp4';
    const VMAP_URL = 'http://localhost:3000/vmap';

    useEffect(() => {
        const initVmap = async () => {
            return fetch(VMAP_URL)
                .then(response => response.text())
                .then(responseXML => {
                    const vmap = new VMAP(new DOMParser().parseFromString(responseXML, 'text/xml'));
                    for (let i = 0; i < vmap.adBreaks.length; i++) {
                        if (vmap.adBreaks[i].timeOffset === "start") {
                            handlePrerollVASTAds(vmap.adBreaks[0].adSource.adTagURI.uri);
                        } else {
                            const timestamp = vmap.adBreaks[i].timeOffset;
                            const [hours, minutes, seconds] = timestamp.split(':').map(Number);
                            const totalSeconds = hours * 3600 + minutes * 60 + seconds;
                            handleVASTAds(vmap.adBreaks[i].adSource.adTagURI.uri, totalSeconds);
                        }
                    }
                })
                .catch(err => {
                    console.error('Error fetching VMAP:', err);
                });
        }

        const handlePrerollVASTAds = (vastUri) => {
            vastClient.get(vastUri)
                .then(setupPrerollVastTracker)
                .catch(err => {
                    console.error('Error fetching VAST:', err);
                });
        }

        const handleVASTAds = (vastUri, timeOffset) => {
            vastClient.get(vastUri)
                .then(parsedVAST => {
                    setupVastTracker(parsedVAST, timeOffset);
                })
                .catch(err => {
                    console.error('Error fetching VAST:', err);
                });
        }

        const setupVastTracker = (parsedVAST, timeOffset) => {
            const ad = parsedVAST.ads[0];
            const creative = ad.creatives[0];
            setVast(oldArray => [...oldArray, {parsedVAST, timeOffset, played: false}])

            vastTrackerRef.current = new VASTTracker(vastClient, ad, creative);

            const adEvents = ['loaded', 'start', 'resume', 'pause', 'firstQuartile', 'midpoint', 'thirdQuartile', 'clickthrough', 'complete', 'playerExpand', 'playerCollapse', 'progress-4'];
            adEvents.forEach(event => {
                vastTrackerRef.current.on(event, () => {
                    console.log(`Ad ${event}`);
                });
            });

            vastTrackerRef.current.trackImpression();
        }

        const setupPrerollVastTracker = (parsedVAST) => {
            const ad = parsedVAST.ads[0];
            const creative = ad.creatives[0];
            const newVideoSrc = parsedVAST.ads[0].creatives[0].mediaFiles[0].fileURL
            setVideoSrc(newVideoSrc);

            setVast(oldArray => [...oldArray, {parsedVAST, timeOffset: 0, played: false}])
            setVideoRedirectionUrl(parsedVAST.ads[0].creatives[0].videoClickThroughURLTemplate.url);

            vastTrackerRef.current = new VASTTracker(vastClient, ad, creative);

            const adEvents = ['loaded', 'start', 'resume', 'pause', 'firstQuartile', 'midpoint', 'thirdQuartile', 'clickthrough', 'complete', 'playerExpand', 'playerCollapse', 'progress-4'];
            adEvents.forEach(event => {
                vastTrackerRef.current.on(event, () => {
                    console.log(`Ad ${event}`);
                });
            });

            vastTrackerRef.current.trackImpression();

            loadVideo(newVideoSrc);
        };

        initVmap();
    }, []);

    const getMacrosParam = () => {
        const video = videoRef.current;
        const currentTime = video.currentTime;
        const duration = video.duration;
        const adProgressMacro = Math.round((currentTime / duration) * 100);
        const playerSizeMacro = `${video.videoWidth}x${video.videoHeight}`;
        const adPositionMacro = videoTime > 0 ? 'mid-roll' : 'pre-roll';

        return {
            ADPLAYHEAD: adProgressMacro,
            PLAYERSIZE: playerSizeMacro,
            BREAKPOSITION: adPositionMacro
        };
    };

    function handleSetTimeout() {
        setTimeout(() => {
            if (isAdPlayingRef.current) {
                setShowSkipButton(true);
            }
        }, 5000);
    }

    const loadVideo = (currentVideoSrc) => {
        if (videoRef.current && currentVideoSrc) {
            videoRef.current.load();
            videoRef.current.play();
            isAdPlayingRef.current = true;

            vastTrackerRef.current.load(getMacrosParam());

            handleSetTimeout(isAdPlayingRef.current);
        }
    };

    const handleVideoEnded = () => {
        if (isAdPlayingRef.current) {
            const macrosParam = getMacrosParam();

            vastTrackerRef.current.complete(macrosParam);
            setVideoSrc(VIDEO_SRC);
            isAdPlayingRef.current = false;
            videoRef.current.load();
            videoRef.current.play();
            setShowSkipButton(false);

            if (videoTime > 0) {
                videoRef.current.currentTime = videoTime;
            }
        }
    };

    const handleVideoPlay = () => {
        if (isAdPlayingRef.current) {
            const macrosParam = getMacrosParam();

            vastTrackerRef.current.setPaused(false, macrosParam);
        }
    };

    const handleVideoPause = () => {
        if (isAdPlayingRef.current) {
            const macrosParam = getMacrosParam();

            vastTrackerRef.current.setPaused(true, macrosParam);
        }
    };

    const handleVideoClick = () => {
        if (isAdPlayingRef.current) {
            vastTrackerRef.current.click();
        }
    };

    const handleFullScreenChange = () => {
        if (document.fullscreenElement) {
            const macrosParam = getMacrosParam();

            vastTrackerRef.current.setExpand(true, macrosParam);
        } else {
            const macrosParam = getMacrosParam();

            vastTrackerRef.current.setExpand(false, macrosParam);
        }
    };

    useEffect(() => {
        videoRef.current.addEventListener('fullscreenchange', handleFullScreenChange);

        return () => {
            videoRef.current.removeEventListener('fullscreenchange', handleFullScreenChange);
        }

    }, [vastTrackerRef.current]);

    const handleSkipButtonClick = () => {
        setVideoSrc(VIDEO_SRC);
        isAdPlayingRef.current = false;
        videoRef.current.load();
        videoRef.current.play();
        setShowSkipButton(false);

        if (videoTime > 0) {
            videoRef.current.currentTime = videoTime;
        }
    };

    const handleOnTimeUpdate = () => {
        if (vast.length > 0) {
            const adToPlay = vast.find(ad => ad.timeOffset === Math.round(videoTime))

            const currentTime = videoRef.current.currentTime;
            const macrosParam = getMacrosParam();
            vastTrackerRef.current.setProgress(currentTime, macrosParam);

            const adToPlayIndex = vast.findIndex(ad => {
                return ad.parsedVAST.ads[0].creatives[0].mediaFiles[0].fileURL === videoSrc
                    && ad.timeOffset === Math.round(videoTime)
                    && !ad.played
            });

            const updatedVast = [...vast];
            if (adToPlayIndex !== -1) {
                updatedVast[adToPlayIndex].played = true;
                setVast(updatedVast);
            }

            if(!isAdPlayingRef.current) {
                setVideoTime(videoRef.current.currentTime);

            }

            if (!isAdPlayingRef.current && adToPlay && !adToPlay.played) {
                setVideoTime(videoRef.current.currentTime);
                setVideoSrc(adToPlay.parsedVAST.ads[0].creatives[0].mediaFiles[0].fileURL);
                isAdPlayingRef.current = true;
                loadVideo(adToPlay.parsedVAST.ads[0].creatives[0].mediaFiles[0].fileURL);
            }
        }
    }

    return (
        <div className="container">
            <a href={videoRedirectionUrl} target="_blank">
                <video controls
                       width="700"
                       ref={videoRef}
                       onTimeUpdate={handleOnTimeUpdate}
                       onClick={handleVideoClick}
                       onEnded={handleVideoEnded}
                       onPause={handleVideoPause}
                       onPlay={handleVideoPlay}
                       muted>
                    <source src={videoSrc} type="video/mp4"/>
                </video>
            </a>
            {showSkipButton && <button className="skip-button" onClick={handleSkipButtonClick}>Skip</button>}
        </div>
    );
}

export default App;
