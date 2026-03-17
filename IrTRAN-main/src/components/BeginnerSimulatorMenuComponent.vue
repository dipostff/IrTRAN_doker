<script setup></script>

<template>
    <div class="container" style="padding-top: 80px;">
        <form class="setting">
            <header style="margin-left: 15px;">
                <div class="row mb-1">
                    <label class="col-auto col-form-label label-custom mb-0" style="font-size: large; font-weight: bold; width: auto;">Настройки режима</label>
                </div>
            </header>

            <fieldset class="field">

                <div class="row mb-1">
                    <label class="col-auto col-form-label label-custom mb-0" for="SwitchTeory">Обращение к теории</label>
                    <div class="col-auto form-check-inline form-switch">
                        <input class="form-check-input" type="checkbox" id="SwitchTeory">
                    </div>      
                </div>

                <div class="row mb-1">
                    <label class="col-auto col-form-label label-custom mb-0" for="SwitchCheckerrors">Проверка ошибок</label>
                    <div class="col-auto form-check-inline form-switch">
                        <input class="form-check-input" type="checkbox" id="SwitchCheckerrors">
                    </div>      
                </div>

                <div class="row mb-1">
                    <label class="col-auto col-form-label label-custom mb-0" for="SwitchViewerrors">Видимость ошибок</label>
                    <div class="col-auto form-check-inline form-switch">
                        <input class="form-check-input" type="checkbox" id="SwitchViewerrors">
                    </div>
                </div>

                <div class="row mb-1">
                    <label class="col-auto col-form-label label-custom mb-0" for="SwitchCheckerrors">Подсказки</label>
                    <div class="col-auto form-check-inline form-switch">
                        <input class="form-check-input" type="checkbox" id="SwitchViewhints">
                    </div>
                </div>
            </fieldset>
            
            <footer>
                <div class="row mb-1">
                    <button type="submit" class="btn btn-custom">Подтвердить</button>
                    <button type="reset" class="btn btn-custom">Отменить</button>
                </div>
            </footer>

        </form>
    </div>
    
        
    <div class="container">
        <div class="card-container">
        
           
                <a class="card-square" style="border-radius: 10px;" href="">
                    <img src="@/assets/IMAGES/AppID_2.png" alt="Заявка на грузоперевозку" />
                    <span class="card-text" style="text-decoration: none;">Заявка на грузоперевозку</span>
                </a>
            
            
                <a class="card-square" style="border-radius: 10px;" href="">
                    <img src="@/assets/IMAGES/AppID_1.png" alt="Накладная" />
                    <span class="card-text">Накладная</span>
                </a>
          
            
                <a class="card-square" style="border-radius: 10px;" href="">
                    <img src="https://cdn-icons-png.freepik.com/512/3566/3566009.png" alt="Акты">
                    <span class="card-text">Акты</span>
                </a>
            
            
                <a class="card-square" style="border-radius: 10px;" href="">
                    <img src="https://d1xez26aurxsp6.cloudfront.net/models/mkjAgYDBaZG/thumbnails/6361d9e53a2ff.png" alt="Памятка приемосдатчика">
                    <span class="card-text">Памятка приемосдатчика</span>
                </a>
            
            
                <a class="card-square" style="border-radius: 10px;" href="">
                    <img src="@/assets/IMAGES/AppID_19.png" alt="Ведомости подачи и уборки" />
                    <span class="card-text">Ведомости подачи и уборки</span>
                </a>
           
           
                <a class="card-square" style="border-radius: 10px;" href="">
                    <img src="@/assets/IMAGES/AppID_11809.png" alt="Накопительная ведомость" />
                    <span class="card-text">Накопительная ведомость</span>
                </a>

        </div>      
        
    </div>
</template>

<style scoped>
                
        .header {
            background-color: #7da5f0;
            height: 50px;
            display: flex;
            align-items: center;
            justify-content: space-between; /* Распределение пространства между элементами */
            padding: 0 15px; /* Отступы слева и справа */
            width: 100%; /* Ширина на всю страницу */
            position: fixed; /* Закрепление шапки в верхней части страницы */
            top: 0; /* Положение вверху */
            left: 0; /* Положение слева */
            z-index: 1000; /* Установка уровня наложения */
        }
        .header .logo {
            display: flex;
            align-items: center;
            margin-left: 30px;
        }
        .header .title {
            flex-grow: 1; /* Занять все доступное пространство */
            text-align: center; /* Центрирование текста */
        }
        .dropdown-toggle::after {
            margin-left: 0.255em;
            vertical-align: 0.255em;
            content: "";
            border: solid transparent;
            border-width: 0.2em 0.2em 0 0.2em;
            border-top-color: #000;
            display: inline-block;
            width: 0;
            height: 0;
            overflow: hidden;
        }
        .dropdown {
            margin-left: 5px; /* Отступ между текстом и кнопкой */
            margin-right: 30px;
        }
        body {
            padding-top: 50px; /* Отступ сверху для контента, чтобы не перекрывался шапкой */
        }
        .card-square {
            width: 200px; /* Ширина квадрата */
            height: 200px; /* Высота квадрата */
            background-color: #EFEFEF; /* Цвет фона */
            display: flex;
            flex-direction: column;
            align-items: center; /* Центрирование по вертикали */
            justify-content: center; /* Центрирование по горизонтали */
            position: relative;
            transition: background-color 0.3s; /* Плавный переход цвета */
            cursor: pointer; /* Изменение курсора при наведении */
            text-align: center; /* Центрирование текста */
            margin: 5px; /* Центрирование карточки в родительском элементе */
            padding: 8px;
        }
        .card-square:hover {
            background-color: #4F85EB; /* Цвет при наведении */
        }
        .card-square img {
            max-width: 50%; /* Ограничение размера иконки */
            max-height: 50%; /* Ограничение размера иконки */
            margin-bottom: 5px; /* Отступ между иконкой и текстом */
        }
        .card-text {
            font-weight: bold;
            margin: 0; /* Убираем отступы у текста */
            font-size: 16px; /* Размер шрифта */
            color: #545556; /* Цвет текста */
        }
        .card-square:hover .card-text {
            color: white; /* Цвет текста при наведении */
        }

        .container{
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: center; 
            padding-top: 40px;
            
        }

        .setting{
            background-color: #EFEFEF;
            width: 100%;
            max-width: 850px;
            height: auto;
            border-radius: 10px;
            padding: 15px;
            display: block;
           
        }

        

        .card-container {
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: center; 
            padding: 5px;
            width: 100%;
            max-width: 900px;
            flex-wrap: wrap;
            gap: 5px;
            
        }

        .btn-custom {
            width: auto;
            background-color: #7DA5F0; 
            color: white; 
            margin-left: 15px;
        }
        .btn-custom:hover {
            background-color: #3E6CB4; 
            color: white; 
        }

        .custom-input {
            background-color: #E3E2FF; 
            height: 30px;
            font-family: "Open Sans", sans-serif;
            font-size: 14px;
            width: 100px;
            border: 1px solid #C1C1C1; 
            
        }
        .input-group .form-control {
            background-color: #E3E2FF; 
            border: 1px solid #C1C1C1; 
            height: 30px;
            font-family: "Open Sans", sans-serif;
            font-size: 14px;
            
        }

        .label-custom{
            width: 200px;
        }

        .field{
            border: #9d9fa0 solid 2px;
            border-radius: 10px;
            padding: 15px;
            margin: 0 0 10px 0;
        }


</style>
