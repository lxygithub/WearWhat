#!/bin/bash
# WearWhat 种子衣物图片批量生成脚本
set -u
OUT="/home/z/my-project/public/seed"
mkdir -p "$OUT"

gen() {
  local file="$1"; shift
  local prompt="$1"; shift
  if [ -s "$OUT/$file" ]; then echo "SKIP $file"; return; fi
  z-ai image -p "$prompt" -o "$OUT/$file" -s 768x1344 >/dev/null 2>&1 && echo "OK $file" || echo "FAIL $file"
}

gen "white-shirt.png" "Professional product photography of a plain white cotton button-up long sleeve dress shirt, neatly laid flat on light warm gray background, soft studio lighting, e-commerce catalog style, high quality, detailed fabric texture, no person, no hanger"

gen "black-sweater.png" "Professional product photography of a black crew neck knitted wool sweater, neatly laid flat on light warm gray background, soft studio lighting, e-commerce catalog style, high quality, detailed knit texture, no person"

gen "navy-stripe-tee.png" "Professional product photography of a navy blue and white horizontal striped short sleeve cotton t-shirt, laid flat on light warm gray background, soft studio lighting, e-commerce catalog style, high quality, no person"

gen "blue-jeans.png" "Professional product photography of dark blue slim fit denim jeans, neatly folded flat lay on light warm gray background, soft studio lighting, e-commerce catalog style, high quality, detailed denim texture, no person"

gen "khaki-pants.png" "Professional product photography of khaki beige chino casual trousers, neatly laid flat on light warm gray background, soft studio lighting, e-commerce catalog style, high quality, no person"

gen "black-shorts.png" "Professional product photography of black athletic sports shorts, laid flat on light warm gray background, soft studio lighting, e-commerce catalog style, high quality, no person"

gen "beige-trench.png" "Professional product photography of a beige khaki double breasted trench coat, neatly laid flat on light warm gray background, soft studio lighting, e-commerce catalog style, high quality, no person"

gen "black-down-jacket.png" "Professional product photography of a black puffer down winter jacket with quilted pattern, laid flat on light warm gray background, soft studio lighting, e-commerce catalog style, high quality, no person"

gen "white-sneakers.png" "Professional product photography of a pair of clean white leather sneakers with rubber soles, side view pair on light warm gray background, soft studio lighting, e-commerce catalog style, high quality, no person"

gen "black-loafers.png" "Professional product photography of a pair of black leather penny loafers dress shoes, side view pair on light warm gray background, soft studio lighting, e-commerce catalog style, high quality, no person"

gen "brown-bag.png" "Professional product photography of a brown leather shoulder messenger bag, on light warm gray background, soft studio lighting, e-commerce catalog style, high quality, no person"

gen "black-dress.png" "Professional product photography of an elegant black knee length cocktail dress with short sleeves, laid flat on light warm gray background, soft studio lighting, e-commerce catalog style, high quality, no person"

echo "ALL_DONE"
