with open(r'c:\Users\User\Desktop\Cording\SFT\exam-papers.html', 'r', encoding='utf-8') as f:
    current_lines = f.read().split('\n')
with open(r'c:\Users\User\Desktop\Cording\SFT\exam-papers-recovered.html', 'r', encoding='utf-8') as f:
    recovered_lines = f.read().split('\n')
idx2 = -1
for i, line in enumerate(current_lines):
    if 'data-year="2026"' in line and '>2026<' in line:
        idx2 = i
        break
print('idx2:', idx2)
if idx2 != -1:
    merged = recovered_lines[:600] + current_lines[idx2+1:]
    for i in range(len(merged)):
        if '<main class="page-wrap animate-stagger">' in merged[i]:
            merged[i] = merged[i].replace('<main class="page-wrap animate-stagger">', '<div class="page-wrap">\n\n        <!-- STAT CARDS -->')
        if '</main>' in merged[i]:
            merged[i] = merged[i].replace('</main>', '</div>')
    with open(r'c:\Users\User\Desktop\Cording\SFT\exam-papers.html', 'w', encoding='utf-8') as f:
        f.write('\n'.join(merged))
    print('Merged length:', len(merged))
