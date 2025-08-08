    (() => {
        'use strict';
        const setupStatusNotifications = function() {
            const statusContainer = document.getElementById('status-container');
            let stillOfflineInterval = null;

            window.showStatus = (message, type = 'online', duration = 8000) => {
                const statusEl = document.createElement('div');
                statusEl.className = 'status d-flex align-items-center p-3 rounded-3 shadow-lg';
                statusEl.classList.add(type);
                statusEl.innerHTML = '<div class="status-icon flex-shrink-0" style="width: 32px; height: 32px;"></div>' +
                                     '<div class="ms-3 fw-medium">' + message + '</div>';
                statusContainer.appendChild(statusEl);

                setTimeout(() => {
                    statusEl.classList.add('show');
                }, 100);

                setTimeout(() => {
                    statusEl.classList.remove('show');
                    statusEl.addEventListener('transitionend', () => statusEl.remove(), { once: true });
                }, duration);
            };

            const handleOnline = function() {
                if (stillOfflineInterval) {
                    clearInterval(stillOfflineInterval);
                    stillOfflineInterval = null;
                }
                window.showStatus('Connected. You are back online!', 'online');
            };

            const handleOffline = function() {
                window.showStatus('Connection lost. You are offline.', 'offline', 10000);
                if (!stillOfflineInterval) {
                    stillOfflineInterval = setInterval(() => {
                        if (!navigator.onLine) {
                            window.showStatus("You're still offline.", 'still-offline', 5000);
                        } else {
                            handleOnline();
                        }
                    }, 20000);
                }
            };

            window.addEventListener('online', handleOnline);
            window.addEventListener('offline', handleOffline);

            if (!navigator.onLine) {
                handleOffline();
            }
        };

        const initializePWA = function() {
            const installBanner = document.getElementById("install-banner");
            const installButton = document.getElementById("install-button");
            const closeButton = document.getElementById("close-install-button");
            if (!installBanner || !installButton || !closeButton || localStorage.getItem("pwaInstallDismissed") === "true") {
              return;
            }
            const showBanner = () => {
              installBanner.classList.remove("d-none");
              setTimeout(() => installBanner.classList.add("show"), 50);
            };
            const hideBanner = (isPermanent = false) => {
              if (isPermanent) {
                localStorage.setItem("pwaInstallDismissed", "true");
              }
              installBanner.classList.remove("show");
              installBanner.addEventListener('transitionend', () => installBanner.classList.add('d-none'), { once: true });
            };
            window.addEventListener("beforeinstallprompt", (e) => {
              e.preventDefault();
              const deferredPrompt = e;
              showBanner();
              installButton.addEventListener("click", () => {
                hideBanner(true);
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then((choiceResult) => {
                  if (choiceResult.outcome === 'accepted') {
                     console.log('PWA installation accepted by user.');
                  }
                });
              }, { once: true });
            });
            closeButton.addEventListener("click", () => {
              hideBanner(true);
            });
        };

        const registerServiceWorker = function() {
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                    navigator.serviceWorker.register('/sw.js')
                });
            }
        };

        const setupLanguageSwitcher = function() {
            const langSelector = document.getElementById('languageSelector');
            const langDropdownButton = document.getElementById('languageDropdown');
            if (!langSelector || !langDropdownButton) return;
            const currentUrl = new URL(window.location.href);
            const currentLang = currentUrl.searchParams.get('lang') || 'en';
            const currentLangElement = langSelector.querySelector('a[data-lang="' + currentLang + '"]');
            if (currentLangElement) {
                const flag = currentLangElement.getAttribute('data-flag');
                const name = currentLangElement.textContent.trim();
                if (flag && name) {
                    langDropdownButton.innerHTML = '<span class="fi fi-' + flag + '"></span><span class="ms-2">' + name + '</span>';
                }
            }
            langSelector.addEventListener('click', (e) => {
                const langLink = e.target.closest('a[data-lang]');
                if (langLink) {
                    e.preventDefault();
                    const selectedLang = langLink.getAttribute('data-lang');
                    if (selectedLang === 'en') {
                        currentUrl.searchParams.delete('lang');
                    } else {
                        currentUrl.searchParams.set('lang', selectedLang);
                    }
                    window.location.href = currentUrl.toString();
                }
            });
        };

        const setupInfiniteScroll = function() {
            const grid = document.querySelector('.movie-grid');
            if (!grid || !grid.dataset.path) return;
            let currentPage = parseInt(grid.dataset.page, 10) || 1;
            const basePath = grid.dataset.path;
            const maxPage = 50;
            let isLoading = false;
            const loaderContainer = document.createElement('div');
            loaderContainer.id = 'loader-container';
            loaderContainer.className = 'col-12 text-center py-4';
            grid.parentNode.appendChild(loaderContainer);
            const loadMoreContent = async () => {
                if (isLoading || currentPage >= maxPage) {
                    if (currentPage >= maxPage && !isLoading) {
                        loaderContainer.innerHTML = '<p class="text-muted">No more results.</p>';
                    }
                    return;
                }
                isLoading = true;
                loaderContainer.innerHTML = '<div class="spinner-grow text-secondary" role="status"><span class="sr-only"></span></div>';
                try {
                    const nextPage = currentPage + 1;
                    const url = new URL(basePath, window.location.origin);
                    url.searchParams.set('page', nextPage);
                    const currentUrlParams = new URLSearchParams(window.location.search);
                    if (currentUrlParams.has('lang')) {
                        url.searchParams.set('lang', currentUrlParams.get('lang'));
                    }
                    if (currentUrlParams.has('q')) {
                        url.searchParams.set('q', currentUrlParams.get('q'));
                    }
                    const response = await fetch(url.toString());
                    if (!response.ok) throw new Error('HTTP error! status: ' + response.status);
                    const text = await response.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(text, 'text/html');
                    const newItems = doc.querySelectorAll('.movie-grid > *');
                    if (newItems.length > 0) {
                        newItems.forEach(item => grid.appendChild(item));
                        currentPage++;
                    } else {
                        currentPage = maxPage;
                        loaderContainer.innerHTML = '<p class="text-muted">No more results.</p>';
                    }
                } catch (error) {
                    console.error('Failed to load more content:', error);
                    loaderContainer.innerHTML = '<p class="text-danger">Could not load more content.</p>';
                } finally {
                    if (currentPage < maxPage) {
                       loaderContainer.innerHTML = '';
                    }
                    isLoading = false;
                }
            };
            const observer = new IntersectionObserver((entries) => {
                if (entries[0].isIntersecting) {
                    loadMoreContent();
                }
            }, { rootMargin: "400px" });
            observer.observe(loaderContainer);
        };

        const setupCollapseHandlers = function() {
            document.querySelectorAll('a[data-bs-toggle="collapse"]').forEach(toggleLink => {
                const targetSelector = toggleLink.getAttribute('href');
                const collapseEl = document.querySelector(targetSelector);
                if (!collapseEl) return;
                const readMoreSpan = toggleLink.querySelector('.read-more');
                const readLessSpan = toggleLink.querySelector('.read-less');
                if (!readMoreSpan || !readLessSpan) return;
                collapseEl.addEventListener('show.bs.collapse', () => {
                    readMoreSpan.style.display = 'none';
                    readLessSpan.style.display = 'inline';
                });
                collapseEl.addEventListener('hide.bs.collapse', () => {
                    readMoreSpan.style.display = 'inline';
                    readLessSpan.style.display = 'none';
                });
            });
        };

        const setupTvDetailTabs = function() {
            const seasonsTabPane = document.getElementById('seasons-tab-pane');
            const episodesTab = document.getElementById('episodes-tab');
            const episodesTabPane = document.getElementById('episodes-tab-pane');
            if (!seasonsTabPane || !episodesTab || !episodesTabPane) return;
            seasonsTabPane.addEventListener('click', async (e) => {
                const seasonItem = e.target.closest('.season-item');
                const loadMoreSeasonsBtn = e.target.closest('#load-more-seasons');
                if (seasonItem) {
                    e.preventDefault();
                    seasonsTabPane.querySelectorAll('.season-item').forEach(item => item.classList.remove('active'));
                    seasonItem.classList.add('active');
                    const seasonNumber = seasonItem.dataset.seasonNumber;
                    const tvId = seasonItem.dataset.tvId;
                    const tvSlug = seasonItem.dataset.tvSlug;
                    const lang = seasonItem.dataset.lang;
                    episodesTab.textContent = 'Season ' + seasonNumber;
                    episodesTabPane.innerHTML = '<div class="d-flex justify-content-center mt-4"><div class="spinner-grow text-secondary" role="status"><span class="visually-hidden">Loading...</span></div></div>';
                    episodesTab.parentElement.style.display = 'block';
                    const tab = new bootstrap.Tab(episodesTab);
                    tab.show();
                    try {
                        const partialUrl = window.location.origin + '/tv/' + tvId + '/season/' + seasonNumber + '?lang=' + lang + '&partial=true';
                        const response = await fetch(partialUrl);
                        if (!response.ok) throw new Error('HTTP error! status: ' + response.status);
                        const episodesHtml = await response.text();
                        episodesTabPane.innerHTML = episodesHtml;
                    } catch (error) {
                        console.error('Failed to load episodes:', error);
                        episodesTabPane.innerHTML = '<p class="text-danger mt-3">Could not load episodes. Please try again later.</p>';
                    }
                }
                if (loadMoreSeasonsBtn) {
                    e.preventDefault();
                    seasonsTabPane.querySelectorAll('.season-item.d-none').forEach(item => {
                        item.classList.remove('d-none');
                    });
                    loadMoreSeasonsBtn.style.display = 'none';
                }
            });
            episodesTabPane.addEventListener('click', (e) => {
                const episodeLink = e.target.closest('.episode-link');
                if(episodeLink) {
                    e.preventDefault();
                    episodesTabPane.querySelectorAll('.episode-link').forEach(link => link.closest('li').classList.remove('active'));
                    episodeLink.closest('li').classList.add('active');
                    const tvId = episodeLink.dataset.tvId;
                    const season = episodeLink.dataset.seasonNumber;
                    const episode = episodeLink.dataset.episodeNumber;
                    const lang = episodeLink.dataset.lang;
                    const watchUrl = 'https://vidsrc.pm/embed/tv?tmdb=' + tvId + '&season=' + season + '&episode=' + episode + '&ds_lang=' + lang;
                    const watchNowBtn = document.getElementById("watch-now-btn");
                    if (watchNowBtn) {
                        watchNowBtn.setAttribute('onclick', "play('" + watchUrl + "')");
                    }
                    play(watchUrl);
                }
            });
            document.body.addEventListener('click', (e) => {
                 const loadMoreEpisodesBtn = e.target.closest('[data-action="load-more-episodes"]');
                 if(loadMoreEpisodesBtn) {
                    e.preventDefault();
                    const list = loadMoreEpisodesBtn.closest('ul');
                    if (list) {
                        list.querySelectorAll('[data-episode-item].d-none').forEach(item => {
                            item.classList.remove('d-none');
                        });
                    }
                    if (loadMoreEpisodesBtn.parentElement) {
                       loadMoreEpisodesBtn.parentElement.style.display = 'none';
                    }
                 }
            });
        };

        const setupAjaxSearch = function() {
            const searchForm = document.querySelector('.search-form-minimal');
            if (!searchForm) return;

            const searchInput = searchForm.querySelector('input[type="search"]');
            const resultsContainer = searchForm.querySelector('.search-results-container');
            let debounceTimer;

            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                const query = e.target.value;

                if (query.length < 3) {
                    resultsContainer.style.display = 'none';
                    return;
                }

                debounceTimer = setTimeout(async () => {
                    const currentUrlParams = new URLSearchParams(window.location.search);
                    const lang = currentUrlParams.get('lang') || 'en';
                    const url = '/ajax/search?q=' + encodeURIComponent(query) + '&lang=' + lang;

                    try {
                        const response = await fetch(url);
                        if (!response.ok) throw new Error('Search request failed');
                        const html = await response.text();
                        resultsContainer.innerHTML = html;
                        resultsContainer.style.display = 'block';
                    } catch (error) {
                        console.error('AJAX search error:', error);
                        resultsContainer.innerHTML = '<div class="p-3 text-center text-danger">Could not fetch results.</div>';
                        resultsContainer.style.display = 'block';
                    }
                }, 300);
            });

            document.addEventListener('click', (e) => {
                if (!searchForm.contains(e.target)) {
                    resultsContainer.style.display = 'none';
                }
            });
        };

        const setupGeneralEventListeners = function() {
            document.addEventListener('error', (e) => {
                if (e.target.tagName === 'IMG' && !e.target.dataset.fallback) {
                    e.target.src = '/no-image.svg';
                    e.target.dataset.fallback = 'true';
                }
            }, true);
        };

        window.play = (videoSrc) => {
            const player = document.getElementById("player");
            if (player) {
                player.src = videoSrc;
            }
            setTimeout(() => {
                const modalEl = document.getElementById('staticBackdrop');
                if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                    const myModal = bootstrap.Modal.getOrCreateInstance(modalEl);
                    myModal.show();
                }
                if (document.fullscreenElement) {
                    document.exitFullscreen().catch(err => console.error(err));
                }
            }, 90000);
        };

        document.addEventListener('DOMContentLoaded', () => {
            initializePWA();
            setupStatusNotifications();
            registerServiceWorker();
            setupLanguageSwitcher();
            setupInfiniteScroll();
            setupCollapseHandlers();
            setupGeneralEventListeners();
            setupTvDetailTabs();
            setupAjaxSearch();
        });
    })();
