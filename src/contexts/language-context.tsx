"use client";

import { createContext, useContext, useState, useEffect } from "react";

type Language = "ko" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations = {
  ko: {
    // Header
    "header.frameEditor": "프레임 편집기",
    "header.photoframes": "포토프레임 갤러리",
    "header.boothDemo": "촬영 부스 데모",

    // Home Page
    "home.title": "한국식 인생4컷 포토부스를 웹으로 옮겨온 MVP입니다. 생일 주인공이 프레임을 직접 커스터마이징하고, 공유 링크를 통해 친구들이 동일한 프레임으로 촬영할 수 있도록 설계했습니다.",
    "home.openEditor": "편집기 열기",
    "home.browseFrames": "포토프레임 둘러보기",
    "home.exploreBooth": "촬영 부스 살펴보기",
    "home.frameEditor": "1. 프레임 편집기",
    "home.frameEditor.feature1": "· 4컷 세로 레이아웃 기반 커스터마이징",
    "home.frameEditor.feature2": "· 슬롯별 사진 업로드, 드래그/확대/회전 지원",
    "home.frameEditor.feature3": "· 배경 제거(Remove.bg API) 및 스티커 레이어",
    "home.frameEditor.feature4": "· 저장 시 공유 가능한 링크(slug) 생성",
    "home.photoBooth": "2. 촬영 부스",
    "home.photoBooth.feature1": "· 실시간 카메라 + 프레임 오버레이",
    "home.photoBooth.feature2": "· 3-2-1 카운트다운 후 자동 촬영 반복",
    "home.photoBooth.feature3": "· 촬영된 컷이 자동으로 레이아웃에 배치",
    "home.photoBooth.feature4": "· 결과물은 1080×1920 PNG로 다운로드",

    // Editor
    "editor.newText": "새 텍스트",
    "editor.birthdayPhoto": "생일 축하 포토부스",
    "editor.shotNumber": "번 컷",
    "editor.templateInfo": "템플릿 정보",
    "editor.projectName": "프로젝트 이름",
    "editor.description": "설명 (선택)",
    "editor.layoutFrame": "레이아웃 & 프레임",
    "editor.cutCount": "컷 수",
    "editor.cuts": "컷",
    "editor.frameColor": "프레임 컬러",
    "editor.backgroundColor": "배경 컬러",
    "editor.frameThickness": "프레임 두께",
    "editor.px": "px",
    "editor.bottomText": "하단 문구",
    "editor.text": "문구",
    "editor.textColor": "텍스트 컬러",
    "editor.fontSize": "폰트 크기",
    "editor.textBox": "텍스트 상자",
    "editor.addText": "텍스트 추가",
    "editor.textBoxDescription": "텍스트 상자를 추가하면 자유롭게 문구를 배치할 수 있습니다.",
    "editor.textId": "텍스트 #",
    "editor.delete": "삭제",
    "editor.textContent": "문구",
    "editor.textColorLabel": "글자 색상",
    "editor.fontSizeLabel": "폰트 크기",
    "editor.alignment": "정렬",
    "editor.alignLeft": "왼쪽",
    "editor.alignCenter": "가운데",
    "editor.alignRight": "오른쪽",
    "editor.imagesStickers": "이미지 & 스티커",
    "editor.addPhoto": "사진 추가",
    "editor.uploadSticker": "스티커 업로드",
    "editor.noImagesYet": "아직 추가된 이미지가 없습니다. 위 버튼을 눌러 업로드해보세요.",
    "editor.imageId": "이미지",
    "editor.connectedCut": "연결된 컷",
    "editor.noConnection": "연결 안함",
    "editor.removingBackground": "배경 제거 중...",
    "editor.removeBackground": "배경 제거",
    "editor.stickerLayer": "스티커 레이어",
    "editor.basicInfo": "기본 정보",
    "editor.basicInfoDesc": "프로젝트 이름과 설명",
    "editor.frameComposition": "프레임 구성",
    "editor.frameCompositionDesc": "컷 수와 색상, 두께 설정",
    "editor.textLabel": "텍스트",
    "editor.textDesc": "하단 문구와 텍스트 상자",
    "editor.imagesStickerLabel": "이미지 & 스티커",
    "editor.imagesStickerDesc": "사진 업로드와 배경제거",
    "editor.previous": "이전",
    "editor.next": "다음",
    "editor.completed": "완료됨",
    "editor.updatePreview": "미리보기 이미지 갱신",
    "editor.saving": "저장 중...",
    "editor.saveAndShare": "저장 & 공유 링크 만들기",
    "editor.saveCompleted": "저장이 완료되었습니다. 공유 링크를 확인하세요!",
    "editor.shareLink": "공유 링크:",
    "editor.supabaseNote": "Supabase 미설정 시 .dist/templates 에 저장됩니다.",

    // Booth
    "booth.frameNotFound": "프레임을 찾을 수 없습니다.",
    "booth.frameNotFoundDesc": "올바른 공유 링크인지 확인하거나 프레임 편집기에서 새로운 프레임을 저장한 뒤 다시 시도해주세요.",
    "booth.photoArrangement": "사진 배치",
    "booth.photoArrangementDesc": "촬영한 사진을 원하는 프레임 위치에 드래그 앤 드롭하세요.",
    "booth.slotsCompleted": "슬롯 배치 완료",
    "booth.selectedPhoto": "선택된 사진",
    "booth.clear": "비우기",
    "booth.dragToPlace": "사진을 드래그해서 배치하세요",
    "booth.confirmArrangement": "배치 확정하기",
    "booth.reshoot": "다시 촬영하기",
    "booth.downloadPNG": "PNG 다운로드",
    "booth.composing": "결과물을 합성하고 있습니다...",
    "booth.finalResult": "최종 결과물",
    "booth.capturedPhotos": "촬영한 사진 목록",
    "booth.capturedPhotosDesc": "사진을 드래그하거나 클릭해 프레임에 배치하세요.",
    "booth.cuts": "컷",
    "booth.waitingForShoot": "촬영 대기중",
    "booth.inUse": "사용중",
    "booth.cameraPermissionNeeded": "카메라 권한이 필요합니다. 아래 버튼을 눌러 브라우저 권한 요청을 허용해주세요.",
    "booth.requesting": "요청 중...",
    "booth.requestCameraPermission": "카메라 권한 요청",
    "booth.totalShotsInfo": "총",
    "booth.totalShotsInfo2": "컷을 순서대로 촬영합니다. 완성 프레임에는",
    "booth.totalShotsInfo3": "컷이 배치됩니다.",
    "booth.progress": "진행 상태:",
    "booth.startShooting": "촬영 시작하기",

    // Status Messages
    "status.countdownActive": "카운트다운 중...",
    "status.captureInProgress": "촬영 중입니다!",
    "status.waitingBetweenShots": "다음 컷까지 잠시 대기해주세요.",
    "status.composingResult": "결과물 합성 중...",
    "status.shootingComplete": "촬영이 끝났어요. 사진 배치 화면으로 이동합니다.",
    "status.allComplete": "촬영이 완료되었습니다!",
    "status.ready": "준비가 되면 아래 버튼을 눌러 촬영을 시작하세요.",
    "status.needPermission": "촬영 전에 카메라 권한 요청 버튼을 눌러 허용해주세요.",

    // Error Messages
    "error.imageLoadFailed": "이미지를 불러오지 못했습니다.",
    "error.imageLoadError": "이미지를 불러오는 중 오류가 발생했습니다.",
    "error.canvasNotFound": "캔버스를 찾을 수 없습니다.",
    "error.templateSaveFailed": "템플릿 저장에 실패했습니다. Supabase 설정을 확인해주세요.",
    "error.backgroundRemovalFailed": "배경 제거에 실패했습니다.",
    "error.backgroundRemovalError": "배경 제거에 실패했습니다. 배경 제거 서비스가 실행되고 있는지 확인해주세요.",
    "error.videoElementNotFound": "비디오 요소를 찾지 못했습니다.",
    "error.videoMetadataLoadFailed": "비디오 메타데이터 로드에 실패했습니다.",
    "error.videoResolutionFailed": "비디오 해상도를 가져오지 못했습니다.",
    "error.cameraNotSupported": "현재 브라우저에서는 카메라를 지원하지 않습니다.",
    "error.cameraPermissionNeeded": "카메라 접근 권한이 필요합니다. 브라우저 설정에서 권한을 허용해주세요.",
    "error.cameraPermissionDenied": "카메라 권한이 차단되어 있습니다. 주소창 근처의 카메라 아이콘을 눌러 허용으로 변경해주세요.",
    "error.noCameraDevice": "사용 가능한 카메라 장치를 찾지 못했습니다.",
    "error.cameraInUse": "다른 애플리케이션이 카메라를 사용 중입니다. 종료 후 다시 시도해주세요.",

    // Photoframes Gallery
    "photoframes.title": "포토프레임 갤러리",
    "photoframes.subtitle": "원하는 포토프레임을 선택하고 바로 촬영을 시작하세요!",
    "photoframes.searchPlaceholder": "프레임 검색...",
    "photoframes.noResults": "검색 결과가 없습니다",
    "photoframes.noTemplates": "아직 생성된 템플릿이 없습니다",
    "photoframes.tryDifferentSearch": "다른 검색어를 시도해보세요",
    "photoframes.createFirst": "첫 번째 템플릿을 만들어보세요!",
    "photoframes.createTemplate": "템플릿 만들기",
    "photoframes.totalTemplates": "총 {count}개의 템플릿",
    "photoframes.slots": "슬롯",
    "photoframes.images": "이미지",
    "photoframes.stickers": "스티커",

    // Meta
    "meta.description": "한국식 인생4컷 포토부스 스타일의 프레임 편집 & 촬영 웹 MVP",
    "meta.ogDescription": "프레임 편집기로 커스터마이징하고, 공유 링크를 통해 친구들과 실시간 촬영까지!",
  },
  en: {
    // Header
    "header.frameEditor": "Frame Editor",
    "header.photoframes": "Photoframe Gallery",
    "header.boothDemo": "Photo Booth Demo",

    // Home Page
    "home.title": "A Korean-style 4-cut photo booth MVP brought to the web. Birthday celebrants can customize frames directly, and friends can shoot photos with the same frame through shared links.",
    "home.openEditor": "Open Editor",
    "home.browseFrames": "Browse Photoframes",
    "home.exploreBooth": "Explore Photo Booth",
    "home.frameEditor": "1. Frame Editor",
    "home.frameEditor.feature1": "· Customization based on 4-cut vertical layout",
    "home.frameEditor.feature2": "· Photo upload per slot, drag/zoom/rotate support",
    "home.frameEditor.feature3": "· Background removal (Remove.bg API) and sticker layers",
    "home.frameEditor.feature4": "· Generate shareable link (slug) upon saving",
    "home.photoBooth": "2. Photo Booth",
    "home.photoBooth.feature1": "· Real-time camera + frame overlay",
    "home.photoBooth.feature2": "· Automatic shooting after 3-2-1 countdown",
    "home.photoBooth.feature3": "· Captured shots automatically placed in layout",
    "home.photoBooth.feature4": "· Results downloaded as 1080×1920 PNG",

    // Editor
    "editor.newText": "New Text",
    "editor.birthdayPhoto": "Birthday Photo Booth",
    "editor.shotNumber": " Shot",
    "editor.templateInfo": "Template Info",
    "editor.projectName": "Project Name",
    "editor.description": "Description (Optional)",
    "editor.layoutFrame": "Layout & Frame",
    "editor.cutCount": "Shot Count",
    "editor.cuts": " Shots",
    "editor.frameColor": "Frame Color",
    "editor.backgroundColor": "Background Color",
    "editor.frameThickness": "Frame Thickness",
    "editor.px": " px",
    "editor.bottomText": "Bottom Text",
    "editor.text": "Text",
    "editor.textColor": "Text Color",
    "editor.fontSize": "Font Size",
    "editor.textBox": "Text Box",
    "editor.addText": "Add Text",
    "editor.textBoxDescription": "Add text boxes to freely place text anywhere.",
    "editor.textId": "Text #",
    "editor.delete": "Delete",
    "editor.textContent": "Content",
    "editor.textColorLabel": "Text Color",
    "editor.fontSizeLabel": "Font Size",
    "editor.alignment": "Alignment",
    "editor.alignLeft": "Left",
    "editor.alignCenter": "Center",
    "editor.alignRight": "Right",
    "editor.imagesStickers": "Images & Stickers",
    "editor.addPhoto": "Add Photo",
    "editor.uploadSticker": "Upload Sticker",
    "editor.noImagesYet": "No images added yet. Click the button above to upload.",
    "editor.imageId": "Image",
    "editor.connectedCut": "Connected Shot",
    "editor.noConnection": "No Connection",
    "editor.removingBackground": "Removing Background...",
    "editor.removeBackground": "Remove Background",
    "editor.stickerLayer": "Sticker Layer",
    "editor.basicInfo": "Basic Info",
    "editor.basicInfoDesc": "Project name and description",
    "editor.frameComposition": "Frame Composition",
    "editor.frameCompositionDesc": "Shot count, colors, and thickness",
    "editor.textLabel": "Text",
    "editor.textDesc": "Bottom text and text boxes",
    "editor.imagesStickerLabel": "Images & Stickers",
    "editor.imagesStickerDesc": "Photo upload and background removal",
    "editor.previous": "Previous",
    "editor.next": "Next",
    "editor.completed": "Completed",
    "editor.updatePreview": "Update Preview",
    "editor.saving": "Saving...",
    "editor.saveAndShare": "Save & Create Share Link",
    "editor.saveCompleted": "Save completed. Check your share link!",
    "editor.shareLink": "Share Link:",
    "editor.supabaseNote": "Saves to .dist/templates when Supabase is not configured.",

    // Booth
    "booth.frameNotFound": "Frame Not Found",
    "booth.frameNotFoundDesc": "Please check if the share link is correct or save a new frame in the frame editor and try again.",
    "booth.photoArrangement": "Photo Arrangement",
    "booth.photoArrangementDesc": "Drag and drop your captured photos to the desired frame positions.",
    "booth.slotsCompleted": " slots arranged",
    "booth.selectedPhoto": "Selected Photo",
    "booth.clear": "Clear",
    "booth.dragToPlace": "Drag photos here to place them",
    "booth.confirmArrangement": "Confirm Arrangement",
    "booth.reshoot": "Reshoot",
    "booth.downloadPNG": "Download PNG",
    "booth.composing": "Composing final image...",
    "booth.finalResult": "Final Result",
    "booth.capturedPhotos": "Captured Photos",
    "booth.capturedPhotosDesc": "Drag or click photos to place them in the frame.",
    "booth.cuts": " shots",
    "booth.waitingForShoot": "Waiting to Shoot",
    "booth.inUse": "In Use",
    "booth.cameraPermissionNeeded": "Camera permission required. Please click the button below to allow browser permission request.",
    "booth.requesting": "Requesting...",
    "booth.requestCameraPermission": "Request Camera Permission",
    "booth.totalShotsInfo": "Total of",
    "booth.totalShotsInfo2": " shots will be taken in order. The finished frame will have",
    "booth.totalShotsInfo3": " shots arranged.",
    "booth.progress": "Progress:",
    "booth.startShooting": "Start Shooting",

    // Status Messages
    "status.countdownActive": "Countdown in progress...",
    "status.captureInProgress": "Taking photo!",
    "status.waitingBetweenShots": "Please wait for the next shot.",
    "status.composingResult": "Composing result...",
    "status.shootingComplete": "Shooting finished. Moving to photo arrangement screen.",
    "status.allComplete": "Shooting completed!",
    "status.ready": "Press the button below to start shooting when ready.",
    "status.needPermission": "Please click the camera permission request button before shooting.",

    // Error Messages
    "error.imageLoadFailed": "Failed to load image.",
    "error.imageLoadError": "An error occurred while loading the image.",
    "error.canvasNotFound": "Canvas not found.",
    "error.templateSaveFailed": "Failed to save template. Please check Supabase configuration.",
    "error.backgroundRemovalFailed": "Background removal failed.",
    "error.backgroundRemovalError": "Background removal failed. Please check if the background removal service is running.",
    "error.videoElementNotFound": "Video element not found.",
    "error.videoMetadataLoadFailed": "Failed to load video metadata.",
    "error.videoResolutionFailed": "Failed to get video resolution.",
    "error.cameraNotSupported": "Camera is not supported in this browser.",
    "error.cameraPermissionNeeded": "Camera access permission required. Please allow permission in browser settings.",
    "error.cameraPermissionDenied": "Camera permission is blocked. Please click the camera icon near the address bar and change to allow.",
    "error.noCameraDevice": "No available camera device found.",
    "error.cameraInUse": "Camera is being used by another application. Please close it and try again.",

    // Photoframes Gallery
    "photoframes.title": "Photoframe Gallery",
    "photoframes.subtitle": "Choose your favorite photoframe and start taking photos right away!",
    "photoframes.searchPlaceholder": "Search frames...",
    "photoframes.noResults": "No search results found",
    "photoframes.noTemplates": "No templates created yet",
    "photoframes.tryDifferentSearch": "Try a different search term",
    "photoframes.createFirst": "Create your first template!",
    "photoframes.createTemplate": "Create Template",
    "photoframes.totalTemplates": "{count} templates total",
    "photoframes.slots": "slots",
    "photoframes.images": "images",
    "photoframes.stickers": "stickers",

    // Meta
    "meta.description": "Korean-style 4-cut photo booth frame editing & shooting web MVP",
    "meta.ogDescription": "Customize with frame editor and take real-time photos with friends via shared links!",
  },
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>("ko");
  const [isClient, setIsClient] = useState(false);

  // Handle client-side initialization
  useEffect(() => {
    setIsClient(true);
    const saved = localStorage.getItem("language");
    if (saved === "en" || saved === "ko") {
      setLanguage(saved);
    }
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem("language", lang);
  };

  const t = (key: string, params?: Record<string, string | number>) => {
    let translation = translations[language][key as keyof typeof translations[typeof language]] || key;

    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        translation = translation.replace(`{${paramKey}}`, String(value));
      });
    }

    return translation;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}