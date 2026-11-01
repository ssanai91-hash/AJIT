# 테이블용 위스키 원본

사용자가 제공한 `Ajit-Whisky-Props-v1(1).zip`의 PNG 두 장과 manifest다.
원본 PNG의 크기·알파·파일 내용은 변경하지 않았다.

`python3 tools/hd/build_whisky.py`로 같은 해상도의 WebP를 생성한다.
배포 빌드는 생성된 `demo/img/whisky/`를 복사하므로 Pillow 설치가 필요 없다.
브라우저 SVG의 viewBox가 manifest의 프레임으로 투명 여백을 제외해 배치한다.

테이블 위 기존 개인별 임시 병 3개를 치우고, 세 사람 사이에 발렌타인 30년과
조니워커 블루라벨 두 병을 공용 소품으로 놓았다. 잔과 술 고르기 상태는 별도로 유지한다.
