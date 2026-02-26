import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchMessages, markRoomRead, sendTextMessage, uploadRoomFiles, CHAT_MESSAGE_EVENT } from '../../api/chatApi';
import './ChatRoom.css';

import {
    dayKey,
    formatDayLabel,
    pick,
    normalizeTime,
    normalizeFileUrl,
    normalizeFileName,
    normalizeSenderId,
    normalizeContent,
    normalizeType,
    normalizeRead,
} from '../../utils/chat/messageNormalize';

import { upsertRoomMeta } from '../../utils/chat/roomMeta';
import { demoAgentReplyText as demoAgentReply } from '../../utils/chat/demoAgent';

// ==============================
// ✅ bytes -> "68.38KB" formatter
// ==============================
function formatBytes(bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB'];
    let v = n;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
        v /= 1024;
        i += 1;
    }
    const fixed = i === 0 ? 0 : 2;
    return `${v.toFixed(fixed)}${units[i]}`;
}
function formatExpireDate(baseTime) {
    if (!baseTime) return '';

    const base = new Date(baseTime);
    if (Number.isNaN(base.getTime())) return '';

    const expire = new Date(base);
    expire.setDate(expire.getDate() + 7);

    const yyyy = expire.getFullYear();
    const mm = String(expire.getMonth() + 1).padStart(2, '0');
    const dd = String(expire.getDate()).padStart(2, '0');

    return `~${yyyy}.${mm}.${dd}`;
}
export default function ChatRoom() {
    // === Helpers: User Action & Mark Last Message Read ===
    const onUserAction = () => {
        lastUserActionAtRef.current = Date.now();
        if (consultModeRef.current === 'human') scheduleInactivityTimers();
    };

    const markLastMyMessageRead = (list) => {
        const arr = Array.isArray(list) ? list : [];
        let lastIdx = -1;
        for (let i = arr.length - 1; i >= 0; i--) {
            if (arr[i]?.from === 'me') {
                lastIdx = i;
                break;
            }
        }
        if (lastIdx < 0) return arr;
        if (arr[lastIdx]?.read) return arr;
        return arr.map((m, idx) => (idx === lastIdx ? { ...m, read: true } : m));
    };
    const { roomId } = useParams();
    const rid = roomId || 'demo-room';
    const draftKey = `draft_${rid}`;
    const draftTimeKey = `draft_updatedAt_${rid}`;
    const draftHydratedRef = useRef(false);

    useEffect(() => {
        if (!rid) return;
        upsertRoomMeta(rid, { title: '세무쳇' }); // unreadCount 건드리지 마!
    }, [rid]);

    const listRef = useRef(null);
    const fileInputRef = useRef(null);
    const textareaRef = useRef(null);

    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [consultMode, setConsultMode] = useState('bot');
    // agentName은 사용되지 않으므로 제거
    // ✅ 메시지 전송 상태
    const [sending, setSending] = useState(false);
    const connectTimerRef = useRef(null);

    const waitIntervalRef = useRef(null);
    const waitCountRef = useRef(0);

    // ✅ 연결 대기 중 입력 버퍼(상담사 연결 전에도 메시지 입력 가능)
    const pendingDuringConnectRef = useRef([]); // 대기 중 보낸 메시지들
    const connectAckShownRef = useRef(false); // "접수되었습니다" 안내 1회만

    // ✅ 상담 종료 연출(상담사가 종료하거나, 종료 안내 후 사용자가 !종료)
    const endHintShownRef = useRef(false);
    const autoEndScheduledRef = useRef(false);
    const humanTurnCountRef = useRef(0);

    // ✅ 상담 무응답 타이머 refs
    const inactivityWarnTimerRef = useRef(null);
    const inactivityEndTimerRef = useRef(null);
    const lastUserActionAtRef = useRef(Date.now());

    // ✅ consultMode 최신값 참조(타이머 콜백 stale 방지)
    const consultModeRef = useRef(consultMode);
    useEffect(() => {
        consultModeRef.current = consultMode;
    }, [consultMode]);

    const clearWaitInterval = () => {
        if (waitIntervalRef.current) {
            clearInterval(waitIntervalRef.current);
            waitIntervalRef.current = null;
        }
    };
    const clearInactivityTimers = () => {
        if (inactivityWarnTimerRef.current) {
            clearTimeout(inactivityWarnTimerRef.current);
            inactivityWarnTimerRef.current = null;
        }
        if (inactivityEndTimerRef.current) {
            clearTimeout(inactivityEndTimerRef.current);
            inactivityEndTimerRef.current = null;
        }
    };

    // Placeholder for missing function
    const scheduleInactivityTimers = () => {
        // Implement timer scheduling logic here if needed
    };

    // Removed misplaced pushSystemMessage and picked usage from here (handled in onClickAiCounselor)

    // Removed stray '네;' line

    // === Inactivity/Bot Switch Logic ===
    // switchToBotDueToInactivity 함수는 사용되지 않아 삭제함 (no-unused-vars 경고 제거)

    // 시스템 메시지를 추가하는 함수(useCallback으로 감싸기)
    const pushSystemMessage = React.useCallback((text) => {
        setMessages((prev) => [
            ...prev,
            {
                id: `system-${Date.now()}`,
                from: 'system',
                type: 'SYSTEM',
                text,
                time: new Date().toISOString(),
                read: true,
            },
        ]);
        requestAnimationFrame(scrollToBottom);
    }, []);

    // 상담 종료 함수 (setAgentName 제거)

    const endConsultation = (endedBy = 'user') => {
        // ✅ 연결/대기 타이머 정리
        if (connectTimerRef.current) {
            clearTimeout(connectTimerRef.current);
            connectTimerRef.current = null;
        }
        clearWaitInterval();
        clearInactivityTimers();

        // ✅ 세션 상태 초기화
        setConsultMode('bot');
        pendingDuringConnectRef.current = [];
        connectAckShownRef.current = false;
        endHintShownRef.current = false;
        autoEndScheduledRef.current = false;
        humanTurnCountRef.current = 0;

        // ✅ 종료 멘트(요청한 문구 2줄이 "마지막"으로 남도록)
        pushSystemMessage(
            '고객님의 소중한 시간에 적지 않은 기다림을 드렸습니다. 배려하고 기다려 주셔서 감사합니다. 건강 잘 챙기시고 행복하세요\n\n상담원과의 채팅 상담이 종료되었습니다.',
        );
    };

    useEffect(() => {
        // ✅ 방 들어오자마자 input === '' 때문에 draft가 지워지는 걸 방지
        if (!draftHydratedRef.current) return;

        if (input && input.trim().length > 0) {
            localStorage.setItem(draftKey, input);
            localStorage.setItem(draftTimeKey, String(Date.now()));
        } else {
            localStorage.removeItem(draftKey);
            localStorage.removeItem(draftTimeKey);
        }

        window.dispatchEvent(new Event('chat_meta_updated'));
    }, [input, draftKey, draftTimeKey, pushSystemMessage]);

    useEffect(() => {
        const savedDraft = localStorage.getItem(draftKey);
        if (savedDraft) setInput(savedDraft);

        draftHydratedRef.current = true;
    }, [rid, draftKey]);

    // { [messageId]: true/false }
    const [expandedTxt, setExpandedTxt] = useState(() => ({}));

    // ✅ 다운로드 버튼 상태 + 실패 표시
    // { [messageId]: { downloaded?: boolean, downloadFailed?: boolean, expired?: boolean } }
    const [fileActionState, setFileActionState] = useState(() => ({}));
    const markAction = (id, patch) => {
        setFileActionState((prev) => ({
            ...prev,
            [id]: { ...(prev?.[id] || {}), ...patch },
        }));
    };

    const MY_ID = 1;

    const scrollToBottom = () => {
        const el = listRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
        requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
    };

    // ✅ textarea 자동 높이
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }, [input, draftKey, draftTimeKey]);

    // ==============================
    // ✅ 다운로드
    // - downloadUrl 있으면 우선 사용
    // - 410 -> 만료 표시
    // ==============================
    const downloadFile = async (m) => {
        const url = m?.downloadUrl || m?.fileUrl; // ✅ 우선순위: downloadUrl
        if (!url) return;

        try {
            markAction(m.id, { downloadFailed: false, expired: false });

            const res = await fetch(url, { credentials: 'include' });

            if (res.status === 410) {
                // ✅ 만료
                markAction(m.id, { expired: true, downloadFailed: false });
                return;
            }

            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const blob = await res.blob();
            const a = document.createElement('a');
            const objUrl = window.URL.createObjectURL(blob);

            a.href = objUrl;
            a.download = m.fileName || 'file';

            document.body.appendChild(a);
            a.click();
            a.remove();

            window.URL.revokeObjectURL(objUrl);

            markAction(m.id, { downloaded: true });
        } catch (e) {
            console.error('다운로드 실패:', e);
            markAction(m.id, { downloadFailed: true });
        }
    };

    // ==============================
    // ✅ 메시지 로드
    // ==============================
    const loadMessages = async () => {
        if (!rid) return;

        try {
            setLoading(true);

            // ✅ chatApi fetchMessages는 "배열"을 리턴함
            const raw = await fetchMessages(rid);

            // ✅ 보고 있는 방 읽음 처리
            await markRoomRead(rid).catch(() => {});

            const mapped = (Array.isArray(raw) ? raw : []).map((m) => {
                const senderId = normalizeSenderId(m);
                const isMe = String(senderId) === String(MY_ID) || String(m?.from) === 'me';

                return {
                    id: pick(m, 'id', 'message_id', 'messageId') ?? `unknown-${Math.random()}`,
                    from: isMe ? 'me' : 'agent',
                    type: normalizeType(m),
                    text: normalizeContent(m),
                    fileUrl: normalizeFileUrl(m),
                    fileName: normalizeFileName(m),
                    downloadUrl: pick(m, 'downloadUrl', 'download_url') ?? null, // ✅ 추가
                    attachments: pick(m, 'attachments') ?? null, // ✅ 추가 (size용)
                    time: normalizeTime(m),
                    read: normalizeRead(m),
                };
            });

            setMessages(mapped);

            // ✅ unread 계산 재료 갱신
            localStorage.setItem(`chat_history_${rid}`, JSON.stringify(mapped));
            localStorage.setItem(`chat_lastRead_${rid}`, new Date().toISOString());
            window.dispatchEvent(new Event('chat_meta_updated'));
        } catch (e) {
            console.error('메시지 불러오기 실패:', e);
        } finally {
            setLoading(false);
            requestAnimationFrame(scrollToBottom);
        }
    };

    useEffect(() => {
        if (!rid) return;

        loadMessages();

        // ✅ 지금 내가 보고 있는 방 기록
        localStorage.setItem('chat_active_room', String(rid));
        localStorage.setItem(`chat_lastRead_${rid}`, new Date().toISOString());
        window.dispatchEvent(new Event('chat_meta_updated'));

        return () => {
            const cur = localStorage.getItem('chat_active_room');
            if (cur === String(rid)) localStorage.removeItem('chat_active_room');

            // ✅ 타이머 정리(대기/무응답/연결)
            clearWaitInterval();
            clearInactivityTimers();
            if (connectTimerRef.current) {
                clearTimeout(connectTimerRef.current);
                connectTimerRef.current = null;
            }
        };
        // eslint-disable-next-line
    }, [rid]);

    // ==============================
    // 🔥 실시간 이벤트 구독
    // ==============================
    useEffect(() => {
        const handler = (e) => {
            const { roomId, message } = e.detail || {};
            if (!message) return;
            if (String(roomId) !== String(rid)) return;

            // 내 텍스트는 서버 재반영시 중복 방지용: 읽음 처리만
            const isMyText = message?.from === 'me' && String(message?.type).toUpperCase() === 'TEXT';
            if (isMyText) {
                markRoomRead(rid).catch(() => {});
                localStorage.setItem(`chat_lastRead_${rid}`, new Date().toISOString());
                window.dispatchEvent(new Event('chat_meta_updated'));
                return;
            }

            setMessages((prev) => {
                const list = Array.isArray(prev) ? prev : [];

                // 1) id 중복 방지
                if (list.some((m) => String(m.id) === String(message?.id))) return list;

                const incoming = {
                    id: message.id ?? `evt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                    from: message.from ?? 'agent',
                    type: message.type ?? 'TEXT',
                    text: message.text ?? '',
                    fileUrl: message.fileUrl ?? null,
                    fileName: message.fileName ?? null,
                    downloadUrl: message.downloadUrl ?? null,
                    attachments: message.attachments ?? null,
                    time: message.time ?? new Date().toISOString(),
                    read: message.read ?? true,
                };

                // 2) ✅ 내 TEXT optimistic(temp) 치환
                // - 내가 보낸 텍스트와 동일
                // - temp id로 시작 (temp-)
                // - 3초 이내면 같은 메시지로 보고 치환
                const isIncomingMyText = incoming.from === 'me' && String(incoming.type).toUpperCase() === 'TEXT';
                if (isIncomingMyText) {
                    const reversed = [...list].reverse();
                    const tempMine = reversed.find(
                        (m) =>
                            String(m?.id || '').startsWith('temp-') &&
                            m?.from === 'me' &&
                            String(m?.type || 'TEXT').toUpperCase() === 'TEXT' &&
                            String(m?.text || '').trim() === String(incoming.text || '').trim(),
                    );

                    if (tempMine) {
                        const tA = new Date(tempMine.time || 0).getTime();
                        const tB = new Date(incoming.time || Date.now()).getTime();
                        if (Number.isFinite(tA) && Number.isFinite(tB) && Math.abs(tA - tB) <= 3000) {
                            const next = list.map((m) => (m.id === tempMine.id ? { ...m, ...incoming } : m));
                            localStorage.setItem(`chat_history_${rid}`, JSON.stringify(next));
                            localStorage.setItem(
                                `chat_meta_${rid}`,
                                JSON.stringify({
                                    preview: incoming.text || '',
                                    updatedAt: Date.now(),
                                }),
                            );
                            window.dispatchEvent(new Event('chat_meta_updated'));
                            return next;
                        }
                    }

                    // 3) ✅ 만약 temp 못 찾았어도, 그냥 추가하지 말고 읽음만 갱신(에코로 들어온 경우)
                    markRoomRead(rid).catch(() => {});
                    localStorage.setItem(`chat_lastRead_${rid}`, new Date().toISOString());
                    window.dispatchEvent(new Event('chat_meta_updated'));
                    return list;
                }

                let next = [...list, incoming];

                // ✅ 상대(상담사/봇) 메시지가 들어오면 → 내 마지막 메시지는 읽음 처리
                if (incoming?.from !== 'me') {
                    next = markLastMyMessageRead(next);
                }

                localStorage.setItem(`chat_history_${rid}`, JSON.stringify(next));
                localStorage.setItem(
                    `chat_meta_${rid}`,
                    JSON.stringify({
                        preview: incoming.text || (incoming.fileName ? `[파일] ${incoming.fileName}` : ''),
                        updatedAt: Date.now(),
                    }),
                );
                window.dispatchEvent(new Event('chat_meta_updated'));
                return next;
            });

            requestAnimationFrame(scrollToBottom);
            window.dispatchEvent(new Event('chat_meta_updated'));
        };

        window.addEventListener(CHAT_MESSAGE_EVENT, handler);
        return () => window.removeEventListener(CHAT_MESSAGE_EVENT, handler);
    }, [rid]);

    // ✅ 마지막 내 메시지 id (읽음 표시용)
    const lastMyMessageId = useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i]?.from === 'me') return messages[i].id;
        }
        return null;
    }, [messages]);

    // ==============================
    // ✅ 데모 상담사 자동응답
    // ==============================
    const demoPushAgentMessage = (userText) => {
        setTimeout(() => {
            const replyText = demoAgentReply(userText);

            window.dispatchEvent(
                new CustomEvent(CHAT_MESSAGE_EVENT, {
                    detail: {
                        roomId: rid,
                        message: {
                            id: `agent-${Date.now()}`,
                            from: 'agent',
                            type: 'TEXT',
                            text: replyText,
                            time: new Date().toISOString(),
                            read: false,
                        },
                    },
                }),
            );

            // ✅ 상담 중이라면(상담사 모드) 랜덤 종료 흐름을 가끔 연출
            if (consultMode === 'human') {
                humanTurnCountRef.current += 1;

                // (1) 상담사가 먼저 종료해버리는 케이스 (낮은 확률)
                if (!autoEndScheduledRef.current && humanTurnCountRef.current >= 3 && Math.random() < 0.1) {
                    autoEndScheduledRef.current = true;
                    setTimeout(
                        () => {
                            if (consultMode !== 'human') return;
                            endConsultation('agent');
                        },
                        12_000 + Math.floor(Math.random() * 18_000),
                    );
                }

                // (2) 상담사가 "!종료로 종료해주세요" 라고 안내하는 케이스 (낮은 확률)
                if (!endHintShownRef.current && humanTurnCountRef.current >= 2 && Math.random() < 0.15) {
                    endHintShownRef.current = true;
                    pushSystemMessage('상담이 마무리되었습니다 🙂\n종료를 원하시면 채팅창에 "!종료"를 입력해 주세요.');
                }
            }
        }, 700);
    };

    // ✅ Enter 전송 + Shift+Enter 줄바꿈
    const onKeyDown = (e) => {
        if (e.nativeEvent?.isComposing) return; // 한글 조합중 Enter 방지
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // ==============================
    // ✅ 텍스트 전송
    // ==============================
    const sendMessage = async (overrideText) => {
        const text = (overrideText ?? input).trim();

        // ✅ "!종료" 입력 시 서버 전송 없이 상담 종료
        if (text === '!종료' || text === '/종료') {
            setInput('');
            localStorage.removeItem(draftKey);
            localStorage.removeItem(draftTimeKey);
            window.dispatchEvent(new Event('chat_meta_updated'));

            if (consultMode !== 'human') {
                pushSystemMessage('현재 상담사 연결 상태가 아닙니다 🙂');
                return;
            }

            endConsultation('user');
            return;
        }
        if (!text || !rid || sending) return;

        // ✅ 상담사 연결 중(human)이라면 유저 활동으로 간주 → 무응답 타이머 리셋
        onUserAction();

        setSending(true);
        setInput('');
        localStorage.removeItem(draftKey);
        localStorage.removeItem(draftTimeKey);
        window.dispatchEvent(new Event('chat_meta_updated'));

        // ✅ 1) optimistic UI (내 메시지 즉시 추가)
        const tempId = `temp-${Date.now()}`;
        const optimistic = {
            id: tempId,
            from: 'me',
            type: 'TEXT',
            text,
            time: new Date().toISOString(),
            read: false,
        };

        setMessages((prev) => {
            const next = [...prev, optimistic];
            localStorage.setItem(`chat_history_${rid}`, JSON.stringify(next));
            localStorage.setItem(`chat_meta_${rid}`, JSON.stringify({ preview: text, updatedAt: Date.now() }));
            return next;
        });

        requestAnimationFrame(scrollToBottom);

        // ✅ 상담사 연결 대기 중에는 메시지를 접수만 하고(버퍼 저장), 상담사 연결 후 이어서 처리
        if (consultMode === 'connecting') {
            pendingDuringConnectRef.current.push(text);

            if (!connectAckShownRef.current) {
                connectAckShownRef.current = true;
                pushSystemMessage(
                    '입력해주신 내용은 접수되었습니다 ✅\n상담사 연결 후 순서대로 확인하여 안내드릴게요 🙂',
                );
            }

            setSending(false);
            return;
        }

        try {
            // ✅ 2) 서버 전송
            const created = await sendTextMessage(rid, text);

            // ✅ 3) 서버 응답 메시지를 이벤트로 다시 흘려보내서(중복 방지 로직 있음)
            if (created) {
                window.dispatchEvent(
                    new CustomEvent(CHAT_MESSAGE_EVENT, {
                        detail: {
                            roomId: rid,
                            message: {
                                id: created.id ?? `me-${Date.now()}`,
                                from: 'me',
                                type: 'TEXT',
                                text: created.text ?? text,
                                time: created.time ?? new Date().toISOString(),
                                read: false,
                            },
                        },
                    }),
                );
            }

            // ✅ 4) 보고있는 방 읽음 처리
            await markRoomRead(rid).catch(() => {});
            localStorage.setItem(`chat_lastRead_${rid}`, new Date().toISOString());
            window.dispatchEvent(new Event('chat_meta_updated'));
        } catch (err) {
            console.error('메시지 전송 실패:', err);
            alert('메시지 전송 실패!');
        } finally {
            setSending(false);

            // ✅ 데모 답변: 연결 대기 중에는 답변 금지(접수만)
            if (consultMode === 'bot' || consultMode === 'human') {
                demoPushAgentMessage(text);
            }
        }
    };

    // ==============================
    // ✅ 파일 업로드
    // ==============================
    const onPickFiles = async (e) => {
        const list = Array.from(e.target.files || []);
        if (list.length === 0 || !rid) return;

        // ✅ 파일 전송도 유저 활동으로 간주
        onUserAction();

        const first = list[0];

        // ✅ txt 내용 미리 읽기(업로드 전에)
        let txtPreview = '';
        const isTxt = first && (first.type === 'text/plain' || /\.txt$/i.test(first.name || ''));

        if (isTxt) {
            try {
                const rawText = await first.text();
                txtPreview = rawText.length > 5000 ? rawText.slice(0, 5000) + '\n…(이하 생략)' : rawText;
            } catch {
                txtPreview = '';
            }
        }

        // ✅ fallback에서도 쓸 localMeta(무조건 존재해야 함)
        const localMeta = list.map((f) => ({
            name: f.name,
            size: f.size,
            type: f.type,
        }));

        try {
            const uploaded = await uploadRoomFiles(rid, list);
            console.log('uploaded:', uploaded);

            // ✅ 서버가 attachments를 안 주면 우리가 만든다 (용량 무조건 표시)
            const attachmentsForUi = list.map((f, idx) => ({
                name: f.name,
                size: f.size,
                type: f.type,
                url: idx === 0 ? uploaded?.downloadUrl || uploaded?.fileUrl || null : null,
            }));

            // ✅ uploaded가 있으면 업로드 응답 기반으로 메시지 생성
            if (uploaded) {
                window.dispatchEvent(
                    new CustomEvent(CHAT_MESSAGE_EVENT, {
                        detail: {
                            roomId: rid,
                            message: {
                                id: uploaded?.id ?? `file-${Date.now()}`,
                                from: uploaded?.from || 'me',
                                type: uploaded?.type || 'FILE',
                                text: uploaded?.text || (isTxt ? txtPreview : ''),
                                fileUrl: uploaded?.fileUrl || null,
                                fileName: uploaded?.fileName || first?.name || null,
                                downloadUrl: uploaded?.downloadUrl || null,
                                attachments: attachmentsForUi, // ✅ 여기서 size가 살아있음!
                                time: uploaded?.time || new Date().toISOString(),
                                read: uploaded?.read ?? false,
                            },
                        },
                    }),
                );

                // ✅ 파일 확인 자동응답(사진/txt)
                const __fname = (uploaded?.fileName || first?.name || '파일').trim();
                const __lower = __fname.toLowerCase();
                let __ack = '';
                if (/(\.jpg|\.jpeg|\.png|\.webp)$/i.test(__lower)) {
                    __ack = `${__fname} 사진을 확인했어요 🙂 어떤 부분이 궁금하세요?`;
                } else if (/\.txt$/i.test(__lower)) {
                    __ack = `${__fname} txt 파일을 확인했어요. 내용 중 어떤 걸 확인해볼까요?`;
                } else {
                    __ack = `${__fname} 파일을 확인했어요. 어떤 점을 도와드릴까요?`;
                }

                // connecting(대기) 중엔 상담사/봇 답변 대신 "접수"만 안내
                if (consultMode === 'connecting') {
                    if (!connectAckShownRef.current) {
                        connectAckShownRef.current = true;
                        pushSystemMessage('파일이 접수되었습니다 ✅\n상담사 연결 후 순서대로 확인하여 안내드릴게요 🙂');
                    }
                } else {
                    demoPushAgentMessage(__ack);
                }

                return;
            }

            // ✅ uploaded가 없으면 fallback로 표시
            const fallbackId = `file-${Date.now()}`;
            window.dispatchEvent(
                new CustomEvent(CHAT_MESSAGE_EVENT, {
                    detail: {
                        roomId: rid,
                        message: {
                            id: fallbackId,
                            from: 'me',
                            type: 'FILE',
                            text: isTxt ? txtPreview : '',
                            fileUrl: null,
                            fileName: first?.name || '파일',
                            downloadUrl: null,
                            attachments: localMeta, // ✅ fallback도 size 표시
                            time: new Date().toISOString(),
                            read: false,
                        },
                    },
                }),
            );

            // ✅ 파일 확인 자동응답(사진/txt)
            const __fname = (first?.name || '파일').trim();
            const __lower = __fname.toLowerCase();
            let __ack = '';
            if (/(\.jpg|\.jpeg|\.png|\.webp)$/i.test(__lower)) {
                __ack = `${__fname} 사진을 확인했어요 🙂 어떤 부분이 궁금하세요?`;
            } else if (/\.txt$/i.test(__lower)) {
                __ack = `${__fname} txt 파일을 확인했어요. 내용 중 어떤 걸 확인해볼까요?`;
            } else {
                __ack = `${__fname} 파일을 확인했어요. 어떤 점을 도와드릴까요?`;
            }

            // connecting(대기) 중엔 상담사/봇 답변 대신 "접수"만 안내
            if (consultMode === 'connecting') {
                if (!connectAckShownRef.current) {
                    connectAckShownRef.current = true;
                    pushSystemMessage('파일이 접수되었습니다 ✅\n상담사 연결 후 순서대로 확인하여 안내드릴게요 🙂');
                }
            } else {
                demoPushAgentMessage(__ack);
            }
        } catch (err) {
            console.error('파일 업로드 실패:', err);
            alert('파일 업로드 실패! (서버/라우트/CORS/응답 확인 필요)');
        } finally {
            e.target.value = '';
            textareaRef.current?.focus();
        }
    };

    const onClickAiCounselor = async () => {
        // 이미 연결중이면 중복 클릭 방지
        if (consultMode === 'connecting') return;

        // 이미 human이면 안내만
        if (consultMode === 'human') {
            pushSystemMessage('이미 상담사와 연결되어 있습니다 🙂');
            return;
        }

        // ✅ 1) "상담사 연결 요청"은 사용자 메시지로 남기되, 대기 중 자동응답은 금지
        // Use sendMessage to send the request as user message
        sendMessage('상담사 연결 요청');

        // ✅ 2) connecting
        setConsultMode('connecting');
        connectAckShownRef.current = false;
        pendingDuringConnectRef.current = [];

        // ✅ 대기열(표시용): 1~10명 / 1인당 3분
        const initialWaiting = Math.floor(Math.random() * 10) + 1;
        waitCountRef.current = initialWaiting;

        const perPersonMinDisplay = 3; // 표시용(분)
        const totalWaitMinDisplay = initialWaiting * perPersonMinDisplay;

        // ✅ 실제 연결 시간은 1~3분 내로(요구사항)
        const totalWaitMs = (Math.floor(Math.random() * 3) + 1) * 60 * 1000;

        pushSystemMessage(
            `상담사 연결 중입니다… 잠시만 기다려주세요 🙏

현재 ${initialWaiting}명 대기중이며, 예상 대기시간은 ${totalWaitMinDisplay}분입니다.`,
        );

        // ✅ 대기열 감소 연출: "항상 1명씩/고정 간격"이 아니라
        // - 업데이트 횟수 자체를 줄이고(2~6회)
        // - 간격은 들쭉날쭉(8~40초)
        // - 한 번에 1~2명 감소할 수도 있게(더 자연스럽게)
        const buildDecrements = (n) => {
            const target = Math.max(0, n - 1);
            if (target === 0) return [];

            const maxUpdates = Math.min(6, target);
            const updates = Math.max(2, Math.min(maxUpdates, 2 + Math.floor(Math.random() * (maxUpdates - 1))));

            // 감소량(합=target) 만들기: 1~2씩 섞기
            let left = target;
            const decs = [];
            for (let i = 0; i < updates - 1; i++) {
                const d = left >= 2 && Math.random() < 0.35 ? 2 : 1;
                decs.push(d);
                left -= d;
                if (left <= 0) break;
            }
            if (left > 0) decs.push(left);
            return decs;
        };

        const randBetween = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

        const decrements = buildDecrements(initialWaiting);
        const usable = Math.floor(totalWaitMs * 0.8); // 마지막 연결 전 '잠깐 멈칫' 느낌 남기기
        const minGap = 8_000;
        const maxGap = 40_000;

        const gaps = decrements.map(() => randBetween(minGap, maxGap));
        const sumGaps = gaps.reduce((x, y) => x + y, 0) || 1;
        const scale = Math.min(1, usable / sumGaps);

        const schedule = [];
        let acc = 0;
        for (let i = 0; i < gaps.length; i++) {
            acc += Math.max(minGap, Math.floor(gaps[i] * scale));
            schedule.push(acc);
        }

        // 기존 interval 정리
        clearWaitInterval();

        let remaining = initialWaiting;

        // 감소 메시지 예약
        schedule.forEach((atMs, idx) => {
            const dec = decrements[idx] ?? 1;

            setTimeout(() => {
                if (consultMode !== 'connecting') return;

                remaining = Math.max(1, remaining - dec);
                waitCountRef.current = remaining;

                const etaMin = remaining * perPersonMinDisplay;

                // 너무 도배되지 않도록: 남은 인원이 줄었을 때만 찍기
                pushSystemMessage(`현재 ${remaining}명 대기중이며, 예상 대기시간은 ${etaMin}분입니다.`);
            }, atMs);
        });

        // ✅ 3) 실제 대기시간 후 human 전환
        if (connectTimerRef.current) clearTimeout(connectTimerRef.current);

        connectTimerRef.current = setTimeout(() => {
            clearWaitInterval();

            const agents = ['김세무', '박세무', '이세무', '최세무', '정세무'];
            const picked = agents[Math.floor(Math.random() * agents.length)];

            setConsultMode('human');
            pushSystemMessage(
                `${picked} 상담사님이 연결되었습니다 ✅\n무엇을 도와드릴까요?\n\n` +
                    '상담원 연결 후 5분 이내에 입력이 없으실 경우 상담이 종료될 수 있으니 이 점 참고부탁드립니다.\n' +
                    '상담이 원활히 이루어질 수 있도록 채팅알림을 확인해 주세요.\n\n' +
                    '상담을 종료하시려면 "!종료"를 입력해주세요.',
            );

            // ✅ 연결된 순간부터 무응답 타이머 시작
            lastUserActionAtRef.current = Date.now();
            scheduleInactivityTimers();

            // ✅ 대기 중 접수된 메시지 처리
            const pending = pendingDuringConnectRef.current;
            pendingDuringConnectRef.current = [];
            connectAckShownRef.current = false;

            if (pending.length > 0) {
                pushSystemMessage(
                    `대기 중 접수된 메시지 ${pending.length}건을 확인했어요 ✅\n지금부터 이어서 안내드릴게요 🙂`,
                );

                // 너무 스팸처럼 여러 답변을 보내지 않도록 마지막 메시지 기준으로 한 번만 답변
                const last = pending[pending.length - 1];
                const replyText = demoAgentReply(last);
                window.dispatchEvent(
                    new CustomEvent(CHAT_MESSAGE_EVENT, {
                        detail: {
                            roomId: rid,
                            message: {
                                id: `agent-${Date.now()}`,
                                from: 'agent',
                                type: 'TEXT',
                                text: replyText,
                                time: new Date().toISOString(),
                                read: false,
                            },
                        },
                    }),
                );
            }
        }, totalWaitMs);
    };

    const headerTitle = useMemo(() => `세무쳇 (방 ${rid})`, [rid]);

    // ✅ 온라인/오프라인 표시 (상담사 기준)
    const agentStatusText = useMemo(() => {
        if (consultMode === 'connecting') return '🟡 연결 중…';
        if (consultMode === 'human') return '🟢 온라인';
        return '⚫ 오프라인';
    }, [consultMode]);

    return (
        <div className="chatroom-page">
            <div className="chatroom-shell">
                <div className="chatroom-header">
                    <Link to="/chat" className="chatroom-back-btn">
                        ←
                    </Link>
                    <div className="chatroom-title">{headerTitle}</div>
                    <div className="chatroom-status">{loading ? '불러오는 중…' : agentStatusText}</div>
                </div>

                <div ref={listRef} className="chatroom-list">
                    {loading ? (
                        <div>메시지 불러오는 중…</div>
                    ) : (
                        messages.map((m, idx) => {
                            const isMe = m.from === 'me';
                            const currDay = dayKey(m.time);
                            const prevDay = idx > 0 ? dayKey(messages[idx - 1]?.time) : '';
                            const showDayDivider = currDay && currDay !== prevDay;

                            return (
                                <React.Fragment key={m.id}>
                                    {showDayDivider && <div className="day-divider">{formatDayLabel(m.time)}</div>}

                                    <div className={`msg-row ${isMe ? 'me' : 'other'}`}>
                                        <div className={`msg-bubble ${isMe ? 'me' : 'other'}`}>
                                            {m.type === 'FILE' || m.fileName ? (
                                                <div>
                                                    {(() => {
                                                        const fileName = m.fileName || '파일';
                                                        const lower = String(fileName).toLowerCase();
                                                        const dot = lower.lastIndexOf('.');
                                                        const ext = dot > -1 ? lower.slice(dot + 1).toUpperCase() : '';

                                                        return (
                                                            <div className="file-head">
                                                                <div className="file-title" title={fileName}>
                                                                    📎 {fileName}
                                                                </div>

                                                                {/* ✅ 위쪽은 확장자만 (중복 방지) */}
                                                                <div className="file-meta">{ext || 'FILE'}</div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* ✅ 토글(내용 보기/접기) + 이미지/텍스트 프리뷰 */}
                                                    {(() => {
                                                        const name = String(m.fileName || '').toLowerCase();
                                                        const url = String(m.fileUrl || '');

                                                        const isImage =
                                                            name.endsWith('.png') ||
                                                            name.endsWith('.jpg') ||
                                                            name.endsWith('.jpeg') ||
                                                            name.endsWith('.gif') ||
                                                            name.endsWith('.webp') ||
                                                            (m.fileUrl && url.startsWith('http'));

                                                        const hasTxt = m.text && String(m.text).trim().length > 0;

                                                        // 이미지도 아니고 txt도 아니면(일반 파일) 토글 UI 생략
                                                        if (!isImage && !hasTxt) return null;

                                                        const opened = !!expandedTxt?.[m.id];

                                                        return (
                                                            <div style={{ marginTop: 8 }}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        setExpandedTxt((prev) => ({
                                                                            ...prev,
                                                                            [m.id]: !prev?.[m.id],
                                                                        }))
                                                                    }
                                                                    style={{
                                                                        border: '1px solid rgba(255,255,255,0.18)',
                                                                        background: 'rgba(255,255,255,0.06)',
                                                                        color: 'white',
                                                                        padding: '6px 10px',
                                                                        borderRadius: 10,
                                                                        cursor: 'pointer',
                                                                        fontSize: 12,
                                                                        fontWeight: 800,
                                                                    }}
                                                                >
                                                                    {opened ? '내용 접기' : '내용 보기'}
                                                                </button>

                                                                {/* ✅ 펼쳤을 때: 이미지 */}
                                                                {opened && isImage && m.fileUrl && (
                                                                    <div style={{ marginTop: 10 }}>
                                                                        <img
                                                                            src={m.fileUrl}
                                                                            alt={m.fileName || 'image'}
                                                                            style={{
                                                                                maxWidth: '260px',
                                                                                width: '100%',
                                                                                borderRadius: 12,
                                                                                border: '1px solid rgba(255,255,255,0.12)',
                                                                                display: 'block',
                                                                            }}
                                                                        />
                                                                    </div>
                                                                )}

                                                                {/* ✅ 펼쳤을 때: txt */}
                                                                {opened && hasTxt && (
                                                                    <pre
                                                                        style={{
                                                                            marginTop: 10,
                                                                            whiteSpace: 'pre-wrap',
                                                                            background: 'rgba(0,0,0,0.20)',
                                                                            border: '1px solid rgba(255,255,255,0.10)',
                                                                            borderRadius: 12,
                                                                            padding: 10,
                                                                            lineHeight: 1.35,
                                                                            fontSize: 13,
                                                                            opacity: 0.95,
                                                                        }}
                                                                    >
                                                                        {m.text}
                                                                    </pre>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* ✅ 다운로드 버튼 + (아래) 용량/만료 */}
                                                    {(m.downloadUrl || m.fileUrl) && (
                                                        <div
                                                            style={{
                                                                marginTop: 10,
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                alignItems: 'flex-start',
                                                                gap: 6,
                                                            }}
                                                        >
                                                            <div
                                                                style={{
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: 8,
                                                                    flexWrap: 'wrap',
                                                                }}
                                                            >
                                                                <button
                                                                    type="button"
                                                                    onClick={() => downloadFile(m)}
                                                                    style={{
                                                                        border: '1px solid rgba(255,255,255,0.18)',
                                                                        background: fileActionState?.[m.id]?.downloaded
                                                                            ? 'rgba(139,92,246,0.25)'
                                                                            : 'rgba(59,130,246,0.20)',
                                                                        color: 'white',
                                                                        padding: '6px 10px',
                                                                        borderRadius: 10,
                                                                        cursor: 'pointer',
                                                                        fontSize: 12,
                                                                        fontWeight: 800,
                                                                    }}
                                                                >
                                                                    다운로드
                                                                </button>

                                                                {fileActionState?.[m.id]?.expired && (
                                                                    <span
                                                                        style={{
                                                                            color: '#ffb020',
                                                                            fontWeight: 900,
                                                                            fontSize: 12,
                                                                        }}
                                                                    >
                                                                        보관기간 만료
                                                                    </span>
                                                                )}

                                                                {fileActionState?.[m.id]?.downloadFailed && (
                                                                    <span
                                                                        style={{
                                                                            color: '#ff6b6b',
                                                                            fontWeight: 900,
                                                                            fontSize: 12,
                                                                        }}
                                                                    >
                                                                        다운 실패
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* ✅ 버튼 아래 "용량 · 7일" (여기만 남김) */}
                                                            {(() => {
                                                                const expireLabel = formatExpireDate(m.time);
                                                                const bytes = m?.attachments?.[0]?.size ?? null;
                                                                const sizeLabel = bytes ? formatBytes(bytes) : '';
                                                                const label = sizeLabel
                                                                    ? `${sizeLabel} · ${expireLabel}`
                                                                    : `${expireLabel}`;

                                                                return <div className="file-submeta">{label}</div>;
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                m.text
                                            )}

                                            <div className="msg-meta">
                                                {isMe && m.id === lastMyMessageId && m.read && <span>읽음</span>}
                                                <span>
                                                    {new Date(m.time).toLocaleTimeString('ko-KR', {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        })
                    )}
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.txt"
                    style={{ display: 'none' }}
                    onChange={onPickFiles}
                />

                <div className="chatroom-inputbar">
                    <button onClick={() => fileInputRef.current?.click()}>+</button>
                    <button onClick={onClickAiCounselor}>상담사 연결</button>

                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={onKeyDown}
                        disabled={sending}
                        placeholder={
                            consultMode === 'connecting'
                                ? '대기 중에도 입력 가능해요 (전송하면 접수됩니다)'
                                : '메시지를 입력하세요'
                        }
                    />

                    <button onClick={() => sendMessage()} disabled={sending}>
                        {sending ? '전송중…' : consultMode === 'connecting' ? '접수' : '전송'}
                    </button>
                </div>
            </div>
        </div>
    );
}
