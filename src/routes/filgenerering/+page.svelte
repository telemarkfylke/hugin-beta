<script>
    console.log("Hei verden")
</script>



<main>
    <div class="filesypes">
        <h1>
            Velg filtype
        </h1>

        <div class="btn-row">
            <a class="file-btn pptx-btn" href="/filgenerering/pptx">PowerPoint</a>
            <a class="file-btn docx-btn" href="/filgenerering/docx">Word</a>
        </div>
    </div>
</main>



<style>
.filesypes {
    width: 96%;
    height: 500px;
    margin-top: 50px;
    margin-left: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    }
h1 {
    font-size: 25px;
    text-align: center;
    }
.file-btn {
    display: inline-block; /* Endret fra block til inline-block */
    width: 200px;
    height: 70px;
    box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.25);
    border-style: solid;
    border-width: 1px;
    text-align: center;
    line-height: 70px;
    border-radius: 5px;
    text-decoration: none;
    margin-right: 20px; /* Endret fra margin-left til margin-right */
    }

.pptx-btn {
    background-color: #F05922; /* PowerPoint-oransje */
    color: white;
    border-color: #F05922;
    }

.docx-btn {
    background-color: #2B579A; /* Word-blå */
    color: white;
    border-color: #2B579A;
    margin-top: 0; /* Fjernet margin-top */
    }
</style>