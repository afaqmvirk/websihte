"""Create the blank SIH parent pack; full referenced terms travel with the signature."""
import json, sys
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.platypus import SimpleDocTemplate, Paragraph, PageBreak, Flowable, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import black, white, HexColor
from reportlab.lib.pagesizes import letter

data = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
target = Path(sys.argv[2]); target.parent.mkdir(parents=True, exist_ok=True)
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="Body", fontName="Helvetica", fontSize=9, leading=12, spaceAfter=7))
styles.add(ParagraphStyle(name="Fine", fontName="Helvetica", fontSize=8, leading=10, spaceAfter=6))
styles["Heading1"].fontSize=20; styles["Heading1"].leading=23
styles["Heading2"].fontSize=12; styles["Heading2"].leading=15
styles["Heading2"].spaceBefore=8

class Fields(Flowable):
    def __init__(self, fields):
        super().__init__(); self.fields=fields; self.height=44
    def draw(self):
        c=self.canv; width=504/len(self.fields)
        for index,(name,label) in enumerate(self.fields):
            x=index*width
            c.setFillColor(black); c.setFont("Helvetica",8); c.drawString(x,35,label)
            c.acroForm.textfield(name=name, tooltip=label, x=x, y=5, width=width-10, height=24,
                relative=True, borderWidth=.6, borderColor=black, fillColor=white,
                textColor=black, fontName="Helvetica", fontSize=10, maxlen=160, forceBorder=True)

class Check(Flowable):
    def __init__(self, name, text):
        super().__init__(); self.name=name; self.p=Paragraph(escape(text),styles["Body"])
        self.p.wrap(480,100); self.height=self.p.height+7
    def draw(self):
        self.canv.acroForm.checkbox(name=self.name, tooltip=self.name.replace("_"," "),
            x=0,y=self.height-13,relative=True, size=10,checked=False,buttonStyle="check",
            borderColor=black,fillColor=white,textColor=black,forceBorder=True)
        self.p.drawOn(self.canv,19,7)

def paragraph(text,style="Body"): return Paragraph(escape(text),styles[style])
def footer(c, doc):
    c.saveState(); c.setFont("Helvetica",7); c.setFillColor(HexColor("#444444"))
    c.drawString(54,32,"SIH Ottawa | " + data["version"])
    c.drawRightString(558,32,"Page " + str(doc.page)); c.restoreState()

story=[Paragraph("Parent / guardian consent",styles["Heading1"]),paragraph(data["organizer"]),
       paragraph(data["event"]),paragraph(data["parentForm"]["introduction"],"Fine"),
       Fields([("participant_name","Participant full legal name")]),
       Fields([("guardian_name","Parent / legal guardian full legal name")]),
       Fields([("relationship","Relationship to participant"),("guardian_email","Parent / guardian email")]),
       Fields([("guardian_phone","Parent / guardian phone")])]
story += [paragraph(x) for x in data["parentDeclarations"]]
story += [Check("required_consent",data["parentForm"]["requiredConsent"]),
          Check("optional_media_permission",data["parentForm"]["mediaConsent"]),
          Fields([("guardian_signature","Parent / guardian signature"),("signature_date","Date signed (YYYY-MM-DD)")])]
for document in data["documents"].values():
    story += [PageBreak(),Paragraph(escape(document["title"]),styles["Heading1"]),paragraph(document["introduction"])]
    for section in document["sections"]:
        story.append(KeepTogether([Paragraph(escape(section["title"]),styles["Heading2"]),paragraph(section["paragraphs"][0])]))
        story += [paragraph(p) for p in section["paragraphs"][1:]]
doc=SimpleDocTemplate(str(target),pagesize=letter,rightMargin=54,leftMargin=54,topMargin=42,bottomMargin=48,
                      title="SIH Ottawa 2026 - Parent / guardian consent",author=data["organizer"],invariant=1)
doc.build(story,onFirstPage=footer,onLaterPages=footer)
print(target)
