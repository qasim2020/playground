let urlParams = function () {
    let url = {
        origin: window.location.origin,
        brand: window.location.pathname.split('/')[1],
        permit: window.location.pathname.split('/')[2],
        requiredType: window.location.pathname.split('/')[3],
        module: window.location.pathname.split('/')[4],
        input: window.location.pathname.split('/')[5],
        collection:
            window.location.pathname.split('/')[5].length > 0
                ? window.location.pathname.split('/')[5].split('-')[1]
                : window.location.pathname.split('/')[5],
    };

    return url;
};

let openStages = function (elem) {
    console.log(
        `1. Stages can not be added.  2. Stages are editable.  3. Stages are updated when linkedCols are changed as per a switch statement that is in the following paragraph`,
    );
};

let calcOrder = function (elem, key) {
    // console.log ( $(elem).closest("tr").find(`[key=${key}]`).attr("mydata") );

    if ($(elem).closest('tr').find(`[key=${key}]`).attr('mydata') == '[]') {
        return $(elem).find('span').html('0');
    }

    if (
        ($(elem).closest('tr').find(`[key=${key}]`).attr('mydata') ||
            $(elem).closest('form').find(`[key=${key}]`).attr('mydata')) ==
        undefined
    )
        return $(elem).find('span').html('0');

    let data = {
        items: JSON.parse(
            $(elem).closest('tr').find(`[key=${key}]`).attr('mydata') ||
                $(elem).closest('form').find(`[key=${key}]`).attr('mydata'),
        ),
        FK:
            $(elem).closest('tr').find(`[key=${key}]`).attr('FK') ||
            $(elem).closest('form').find(`[key=${key}]`).attr('FK'),
    };

    let refreshData = function (val) {
        let sum;

        if (val.some((item) => item.length == 0)) {
            sum = 'Invalid data';
        } else {
            sum = val.reduce((total, price) => {
                total += price[0].multiplied;
                return total;
            }, 0);
        }

        $(elem).closest('.formula').find('span').html(sum);
        $(elem).closest('.formula').attr({ mydata: sum });

        if ($(elem).closest('form').attr('row') != 'undefined') {
            let row = $(elem).closest('form').attr('row');
            $(`#${row}`).find('.formula').find('span').html(sum);
            $(`#${row}`).find('.formula').attr({ mydata: sum });
        }
    };

    $.ajax({
        url: `/${urlParams().brand}/auth/data/calcOrder/n`,
        method: 'POST',
        data: data,
        success: (val) => refreshData(val),
    }).fail((err) => console.log(err));
};

$(document).pjax('a[data-pjax]', '#pjax-container');

let runImpFunctions = function () {
    $('.fixed.formula').trigger('onmousedown');
    localStorage.clear();
};

$.pjax.defaults.scrollTo = false;
$.pjax.defaults.timeout = false;

$(document).on('pjax:complete', function () {
    runImpFunctions();
});
runImpFunctions();

let hideMe = function (elem) {
    let col = {
        no: $('th').index(elem),
        name: $(elem).html(),
        index: $(elem).attr('index'),
    };

    $(elem).addClass('d-none');
    $(`.${col.index}`).addClass('d-none');

    let span = `<span index=${col.index} onclick=showMe(this)>${col.name}</span>`;
    $('#hiddenFields').html($('#hiddenFields').html() + span);
};

let showMe = function (elem) {
    let index = $(elem).attr('index');

    $(elem).remove();
    $(`tr > [index=${index}]`).removeClass('d-none');
    $(`.${index}`).removeClass('d-none');
};

let createForm = function (elem) {
    let constructData = function (row) {
        let headings = $('.headings')
            .get()
            .map((val) => {
                return {
                    heading: $(val).attr('formname'),
                    index: $(val).attr('index'),
                };
            });

        let mydata = headings.reduce((total, val) => {
            Object.assign(total, {
                [val.heading]: {
                    val: $(`#${row} > [index=${val.index}]`)
                        .attr('mydata')
                        .trim(),
                    classes: $(`#${row} > [index=${val.index}]`)
                        .attr('class')
                        .trim(),
                    index: $(`#${row} > [index=${val.index}]`)
                        .attr('index')
                        .trim(),
                },
            });

            return total;
        }, {});

        return mydata;
    };

    const rowId = $(elem).closest('tr').find('[index=col0]').attr('mydata');

    let data = constructData($(elem).closest('tr').attr('id'));

    let schema = JSON.parse($(elem).closest('table').attr('schema'));

    let elems = $('.headings')
        .map((key, val) => {
            switch (true) {
                case $(val).attr('formname') == '_id':
                    return {
                        label: 'ID',
                        name: '_id',
                        type: 'String',
                        html: 'brick',
                        classes: data[$(val).attr('formname')].classes,
                        addOn: 'disabled',
                        value: data[$(val).attr('formname')].val,
                    };
                    break;
                default:
                    return {
                        label: $(val).attr('formname').toUpperCase(),
                        name: $(val).attr('formname'),
                        type: schema[$(val).attr('formname')].type,
                        html: schema[$(val).attr('formname')].html,
                        classes: data[$(val).attr('formname')].classes,
                        index: data[$(val).attr('formname')].index,
                        value: data[$(val).attr('formname')].val || '',
                        allowedValues:
                            schema[$(val).attr('formname')].allowedValues,
                        key: schema[$(val).attr('formname')].key,
                        addOn: `onkeyup=saveInput(this,'${data._id.val}','form')`,
                    };
            }
        })
        .get();

    let formString = elems.reduce((total, val, key) => {
        if (val.html == 'link') {
            console.log(val);
            total =
                total +
                `
                   <label for="${val.name}">${val.label}</label>
                   <div class="link" name="${val.name}"><a href="${val.value}">Open</a></div>
                `;
        } else if (val.html == 'textarea') {
            total =
                total +
                `
                   <label for="${val.name}">${val.label}</label>
                   <textarea type="${val.type}" name="${val.name}" cols="30" rows="10" ${val.addOn}>${val.value}</textarea>
                `;
        } else if (val.html == 'ckEditor') {
            total =
                total +
                `
                   <label for="${val.name}">${val.label}</label>
                   <div id="editor" name="${val.name}">${val.value}</div>
                `;
        } else if (val.html == 'photo') {
            console.log(val.value);
            const renderPhotoField = function (imgSrc, imgId = '') {
                return `
                    <label for="${val.name}">${val.label}</label>
                    <div
                        index="${val.index}"
                        class="photo"
                        >
                    <span class="pointer imgUpload">
                        <img src="${imgSrc}" imgId="${imgId}" width="50%" alt="photo" />
                        <div class="uploader" onclick="uploadImage(this)">
                            <i class="fas fa-plus"></i>
                            <i class="fas fa-circle-notch spin font-black d-none"></i>
                        </div>
                        <input class="d-none" type="file" name="${val.name}" accept="image/*"
                                onchange="readSinglePhotoURL(this, '${rowId}')" />
                    </span>
                    </div>`;
            };

            if (!val.value) {
                total += renderPhotoField(
                    'https://res.cloudinary.com/miscellaneous/image/upload/v1657685257/myapp/Picture2_1.png',
                );
            } else {
                const imgData = JSON.parse(val.value);
                console.log(imgData);
                if (imgData && imgData.photo) {
                    total += renderPhotoField(
                        imgData.photo.large,
                        imgData.photo.imgId,
                    );
                } else {
                    total += renderPhotoField(
                        'https://res.cloudinary.com/miscellaneous/image/upload/v1657685257/myapp/Picture2_1.png',
                    );
                }
            }
        } else if (val.html == 'photos') {
            total =
                total +
                `
                    <label for="${val.name}">${val.label}</label>
                    <div
                        index="${val.index}"
                        mydata='${val.value}'
                        class="fixed photos"
                        >
                       <span class="pointer" onclick="uploadImages(this)">${
                           JSON.parse(val.value).length
                       }x photo(s)</span>
                    </div>
                `;
        } else if (val.html == 'formula') {
            total =
                total +
                `
                    <label for="${val.name}">${val.label}</label>
                    <div
                        index='${val.index}'
                        mydata='${val.value}'
                        class="fixed formula"
                        onmousedown=${val.allowedValues}
                        >
                       <span>${val.value}</span>
                    </div>
                `;
        } else if (val.html == 'selectFK') {
            total =
                total +
                `
                    <label for="${val.name}">${val.label}</label>
                    <div
                        index="${val.index}"
                        mydata="${val.value}"
                        FK="${val.allowedValues}"
                        class="fixed pointer selectFK FK"
                        >
                       <span onclick="selectFK(this)" onkeyup="selectFK(this)" contenteditable="true">${val.value}</span>
                        <div class="listedFKs cellBox d-none" type="selectFK">
                            <input type="text" onkeyup="selectFK(this)" value="">
                        </div>
                    </div>
                `;
        } else if (val.html == 'multipleFK') {
            let html = '',
                fields = '';

            if (JSON.parse(val.value).length > 0) {
                html = JSON.parse(val.value).reduce((total, item) => {
                    total += `<span class="pointer" onclick="quantityFK(this)" >${item.slug}</span>`;
                    return total;
                }, '');

                fields = JSON.parse(val.value).reduce((total, item, index) => {
                    total += `
                        <div class="fields items" myId="${item.id}">
                            <input index="${index}" type="text" onfocus="quantityFK(this)" value="${item.slug}" onkeyup="quantityFK(this); saveQuantityFK(this, 'multipleFK')">
                            <i onclick="deleteQuantityFK(this)" class="fas fa-trash"></i>
                        </div>`;

                    return total;
                }, '');
            } else {
                html = `<span class="pointer " onclick="addInputField(this);" >Add ${val.key} </span>`;
            }

            total =
                total +
                `
                    <label for="${val.name}">${val.label}</label>
                    <div
                        index="${val.index}"
                        mydata='${val.value}'
                        FK="${val.allowedValues}"
                        key="${val.key}"
                        class="fixed multipleFK FK"
                        >
                        ${html}
                        <div class="listedFKs cellBox d-none">
                            <div class="static">
                                ${fields}
                                <button type="button" class="pointer" onclick="addInputField(this)"><i class="fas fa-plus"></i></button>
                            </div>
                        </div>
                    </div>
                `;
        } else if (val.html == 'quantityFK') {
            let html = '',
                fields = '';

            if (JSON.parse(val.value).length > 0) {
                html = JSON.parse(val.value).reduce((total, item) => {
                    total += `<span class="pointer" onclick="quantityFK(this)" >${item.quantity}x ${item.slug}</span>`;
                    return total;
                }, '');

                fields = JSON.parse(val.value).reduce((total, item, index) => {
                    console.log(item);

                    total += `
                        <div class="fields" myId="${item.id}">
                            <p>
                                <button type="button" onclick="changeQuantityFK(this, -1)"><i class="fas fa-minus"></i></button>
                                <span>${item.quantity}</span>
                                <button type="button" onclick="changeQuantityFK(this, 1)"><i class="fas fa-plus"></i></button>
                            </p>
                            <i class="fas fa-times"></i>
                            <input index="${index}" type="text" onfocus="quantityFK(this)" value="${item.slug}" onkeyup="quantityFK(this); saveQuantityFK(this)">
                            <i onclick="deleteQuantityFK(this)" class="fas fa-trash"></i>
                        </div>`;

                    return total;
                }, '');
            } else {
                html = `<span class="pointer " onclick="addInputField(this);" >Add ${val.key} </span>`;
            }

            total =
                total +
                `
                    <label for="${val.name}">${val.label}</label>
                    <div
                        index="${val.index}"
                        mydata='${val.value}'
                        FK="${val.allowedValues}"
                        key="${val.key}"
                        class="fixed quantityFK FK"
                        >
                        ${html}
                        <div class="listedFKs cellBox d-none" type="quantityFK">
                            <div class="static">
                                ${fields}
                                <button type="button" class="pointer" onclick="addInputField(this)"><i class="fas fa-plus"></i></button>
                            </div>
                        </div>
                    </div>
                `;
        } else if (val.html == 'webEditor') {
            total =
                total +
                `
                   <label for="${val.name}">${val.label}</label>
                   <div class="webEditor" name="${val.name}" _id="${data._id.val}" onkeyup="saveSlide(this)">${val.value}</div> `;
        } else if (/brick/g.test(val.classes)) {
            total =
                total +
                `
                   <label for="${val.name}">${val.label}</label>
                   <div class="brick green" name="${val.name}"> <span> ${val.value} </span> </div> `;
        } else if (val.html == 'dropdown') {
            let valueArray = val.allowedValues.split(',').map((me) => {
                return {
                    val: me.trim(),
                    selVal: val.value,
                    selected: me.trim() == val.value ? 'selected' : '',
                };
            });

            let string = valueArray.reduce((total2, me) => {
                return (
                    total2 +
                    `<option value="${me.val}" ${me.selected}>${me.val}</option>`
                );
            }, '');

            total =
                total +
                `
                   <label for="${val.name}">${val.label}</label>
                    <div 
                      class="dropdown" 
                      name="${val.name}"
                      onchange="saveInput(this,'${data._id.val}','dropdownForm')"
                      allowedValues="${val.allowedValues}">
                       <select>
                          ${string}
                       </select>
                   </div>
               `;
        } else {
            total =
                total +
                `
                    <label for="${val.name}">${val.label}</label>
                    <input type="${val.type}" name="${val.name}" ${val.addOn} value="${val.value}">
            `;
        }
        return total;
    }, '');

    let form = `
        <form action="" row=${$(elem).closest('tr').attr('id')}> 
            ${formString} 
            <div>
            <button type="button" class="btn close" onclick="openLayer('.formBox', '.layerOne')">Close</button> 
            <button type="button" class="btn saving d-none" disabled>Saving...</button>
            </div>
        </form>
        `;

    $('.layerOne').addClass('d-none');
    $('.formBox').html(form).removeClass('d-none');

    if (document.querySelector('.webEditor')) {
        $('.webEditor .e').attr({
            contenteditable: true,
            onclick: 'editable(this)',
        });
    }

    if (document.querySelector('#editor')) {
        ClassicEditor.create(document.querySelector('#editor'), {
            simpleUpload: {
                // The URL that the images are uploaded to.
                uploadUrl: `/${urlParams().brand}/auth/data/uploadImage/${
                    urlParams().collection
                }`,
                // Enable the XMLHttpRequest.withCredentials property.
                withCredentials: true,
                // Headers sent along with the XMLHttpRequest to the upload server.
                headers: {
                    'X-CSRF-TOKEN': 'CSRF-Token',
                    Authorization: 'Bearer <JSON Web Token>',
                },
            },
        })
            .then((editor) => {
                editor.model.document.on('change:data', () => {
                    let editorData = editor.getData();
                    return saveInput(
                        '#editor',
                        data._id.val,
                        'ckEditor',
                        editorData,
                    );
                });
            })
            .catch((error) => {
                console.error(error);
            });
    }
};

$(document).on('click', '*', function (event) {
    let openModels = {
        selectFK: $(event.target).closest('.FK').hasClass('selectFK'),
        quantityFK:
            $(event.target).closest('.FK').hasClass('quantityFK') ||
            $(event.target).hasClass('fa-trash'),
        multipleFK:
            $(event.target).closest('.FK').hasClass('multipleFK') ||
            $(event.target).hasClass('fa-trash'),
        photos: $(event.target).closest('.photos').hasClass('photos'),
    };

    if (openModels.quantityFK == false) {
        $('.quantityFK > .listedFKs').addClass('d-none');
    }

    if (openModels.multipleFK == false) {
        $('.multipleFK > .listedFKs').addClass('d-none');
    }

    if (openModels.selectFK == false) {
        $('.selectFK > .listedFKs').addClass('d-none');
    }

    if (openModels.photos == false) {
        $('.listedPhotos').remove();
    }
});

let saveInput = function (elem, _id, type, optData) {
    console.log({ elem, _id, type, optData });

    if (
        /(<([^>]+)>)/gi.test($(elem).html()) &&
        type != 'ckEditor' &&
        type != 'dropdown' &&
        type != 'dropdownForm'
    ) {
        let text = $(elem)
            .html()
            .replace(/(<([^>]+)>)/gi, '');
        $(elem).html(text);
    }

    $('.listedPhotos').addClass('d-none');

    if (type != 'selectFK') $('.listedFKs').addClass('d-none');

    let changeConnectedData = function (row, value, moreType) {

        let col = $(`[formname=${$(elem).attr('name')}`).attr('index');

        if (type == 'ckEditor' || type == 'webEditor') {
            $(`#${row} > [index=${col}]`)
                .addClass('page')
                .attr({ mydata: value });
            $(`#${row} > [index=${col}]`)
                .html(`<a class="icon" onclick="createForm(this)">
                            <i class="fas fa-expand-alt black"></i>
                        </a>
                    `);
        } else if (type == 'dropdownForm') {
            $(`#${row} > [index=${col}]`)
            .attr({ mydata: value })
            .find('select')
            .val(value);
        } else {
            $(`#${row} > [index=${col}]`).attr({ mydata: value }).html(value);
        }

        return;
    };

    let data = {},
        name = '';

    switch (true) {
        case type == 'ckEditor':
            changeConnectedData(
                $(elem).closest('form').attr('row'),
                `<div>${optData}</div>`,
            );
            data[$(elem).attr('name')] = optData;
            break;
        case type == 'webEditor':
            changeConnectedData(
                $(elem).closest('form').attr('row'),
                `${optData}`,
            );
            data[$(elem).attr('name')] = optData;
            break;
        case type == 'form':
            changeConnectedData(
                $(elem).closest('form').attr('row'),
                $(elem).val(),
            );
            data[$(elem).attr('name')] = $(elem).val();
            break;
        case type == 'td':
            name = $(`[index=${$(elem).attr('index').trim()}`).attr('formname');
            $(elem).attr({ mydata: $(elem).html() });
            data[name] = $(elem).html().trim();
            break;
        case type == 'selectFK':
            name = $(`[index=${$(elem).attr('index').trim()}`).attr('formname');
            $(elem).attr({ mydata: $(elem).find('span').html() });
            data[name] = $(elem).find('span').html();
            break;
        case type == 'dropdownForm':
            changeConnectedData(
                $(elem).closest('form').attr('row'),
                $(elem).find('select').val(),
                'dropdownForm',
            );
            data[$(elem).attr('name')] = $(elem).find('select').val();
            break;
        case type == 'dropdown':
            console.log('dropdown input saving');
            name = $(`[index=${$(elem).attr('index').trim()}`).attr('formname');
            $(elem).attr({ mydata: $(elem).find('select').val() });
            data[name] = $(elem).find('select').val();
            $(elem).find('option').removeAttr('selected');
            $(elem)
                .find(`option[value="${$(elem).find('select').val()}"]`)
                .attr({ selected: 'selected' });
            break;
        case type == 'cloned':
            name = $(`[index=${$(elem).attr('index').trim()}`).attr('formname');
            if (name == '_id') return;
            data[name] = optData;
            break;
    }

    if (_id == '') {
        _id = $(elem).closest('tr').find('[index=col0]').html();
    }

    $('.btn.saving').html('Saving...').removeClass('d-none');

    $.ajax({
        url: `/${urlParams().brand}/auth/data/updateDocument/${
            urlParams().collection
        }?_id=${_id}`,
        method: 'POST',
        data: data,
        success: (val) => {
            $('.btn.saving').addClass('d-none');
        },
    }).fail((val) => {
        alert(val);
        $('.btn.saving').html('Error while Saving');
    });
};

let cloneMe = function (elem, type, _id) {
    type = type.split('-')[1];

    console.log(type);
    console.log($(elem));

    $(elem)
        .closest('tr')
        .find('td')
        .map((key, val) => {
            console.log(key, val);

            if (key < 2) return; // >

            $('tr:eq(-1)')
                .find(`td[index=col${key - 1}]`)
                .remove();

            if ($(val).hasClass('link')) {
                console.log($(val));
                console.log($(val).html());
                console.log($(val).find('a').attr('href'));
                $(val).clone().appendTo('tr:eq(-1)');
                console.log($(val));
                console.log($(val).html());
                console.log($(val).find('a').attr('href'));
            } else if (
                $(val).hasClass('page') ||
                $(val).hasClass('fixed') ||
                $(val).hasClass('photos')
            ) {
                $(val).clone().appendTo('tr:eq(-1)').removeAttr('onkeyup');
            } else {
                $(val)
                    .clone()
                    .appendTo('tr:eq(-1)')
                    .attr({
                        onkeyup: `saveInput(this, '${_id}', 'td')`,
                    });
            }
        });

    let changings = {
        ser: $(elem).closest('table').find("[formname='ser']").attr('index'),
        slug: $(elem).closest('table').find("[formname='slug']").attr('index'),
        _id: $(elem).closest('table').find("[formname='_id']").attr('index'),
    };

    let getMaxSer = function () {
        let array = $('table')
            .find(`[index=${changings.ser}]`)
            .map((key, val) => {
                if (key == 0) return;
                return Number($(val).html());
            })
            .get();

        return Math.max(...array);
    };

    let slugValue = function () {
        if ($('tr:eq(-1)').find(`[index=${changings.slug}]`).attr('mydata')) {
            return (
                $('tr:eq(-1)').find(`[index=${changings.slug}]`).html() &&
                $('tr:eq(-1)').find(`[index=${changings.slug}]`).html().trim() +
                    `-${getMaxSer() + 1}`
            );
        }

        return false;
    };

    let newValues = {
        maxSer: getMaxSer() + 1,
        slugValue: slugValue(),
        _id: _id,
    };

    $('tr:eq(-1)')
        .find(`[index=${changings.ser}]`)
        .html(newValues.maxSer)
        .attr({ mydata: newValues.maxSer });
    $('tr:eq(-1)')
        .find(`[index=${changings._id}]`)
        .html(newValues._id)
        .attr({ mydata: newValues._id });

    if (changings.slug != undefined) {
        $('tr:eq(-1)')
            .find(`[index=${changings.slug}]`)
            .html(newValues.slugValue)
            .attr({ mydata: newValues.slugValue });
    }

    saveRow();

    return;
};

let saveRow = function (_id) {
    $('tr:eq(-1)')
        .find('td')
        .each((key, val) => {
            if ($(val).hasClass('link')) return;
            if ($(val).hasClass('dropdown')) return;
            if ($(val).hasClass('photo')) return;
            if (key < 2) return;

            if ($(val).hasClass('photos')) {
                JSON.parse($(val).attr('mydata')).forEach((photo) => {
                    let data = {
                        _id: getMyId(val),
                        photo: photo,
                    };

                    $.ajax({
                        url: `/${urlParams().brand}/auth/data/saveImgInArray/${
                            urlParams().collection
                        }`,
                        method: 'POST',
                        data: data,
                        success: (val) => console.log(' img saved in DB'),
                        error: (err, status, response) => console.log(err),
                    });
                });
            } else if ($(val).hasClass('quantityFK')) {
                JSON.parse($(val).attr('mydata')).forEach((item) => {
                    let data = {
                        _id: getMyId(val),
                        key: $(val).attr('key'),
                        item: item,
                    };

                    console.log(data);

                    $.ajax({
                        url: `/${urlParams().brand}/${
                            urlParams().permit
                        }/data/saveItemInArray/${urlParams().collection}`,
                        method: 'POST',
                        data: data,
                        success: (val) => console.log(' item saved in DB'),
                        error: (err, status, response) => console.log(err),
                    });
                });
            } else {
                saveInput(val, _id, 'cloned', $(val).attr('mydata'));
            }

            return;
        });
};

let addNewRow = function (elem, type) {
    $.get(
        `/${urlParams().brand}/gen/data/getMongoId/n`,
        function (data, status) {
            if (status != 'success') return alert('could not get the id');
            let newRow = $(elem)
                .closest('tr')
                .clone()
                .attr({ id: 'row' + ($('tr').get().length - 1) })
                .appendTo('tbody')
                .removeClass('d-none');

            newRow.find('td:eq(0)').html(`
            <a class="icon" onclick="deleteMe(this)"><i class="fas fa-trash" aria-hidden="true"></i></a>
            <a class="icon" onclick="createForm(this)"><i class="fas fa-expand-alt" aria-hidden="true"></i></a>
            `);

            newRow.find('[index=col0]').html(data).attr({ mydata: data });

            newRow.find('.link').each(function () {
                let meta = JSON.parse($(this).attr('meta'));
                $(this)
                    .find('a')
                    .attr({ href: meta.link + data });
                $(this).attr({ mydata: meta.link + data });
            });

            newRow.find('.photos').each(function () {
                let photos = JSON.parse($(this).attr('mydata'));
                $(this).attr({ mydata: JSON.stringify(photos) });
            });

            newRow.find('.dropdown').each(function () {
                let selectedValue = $(this).find('select').val();
                $(this).find('select').val(selectedValue);
            });

            saveRow(data);
        },
    );
};

let deleteMe = function (elem) {
    let _id = $(elem).closest('tr').find('[index=col0]').attr('mydata');
    console.log(_id);

    $.get(
        `/${urlParams().brand}/auth/data/deleteDocumentAuth/${
            urlParams().collection
        }?_id=${_id}`,
        function (data, status) {
            if (status != 'success') return alert('could not get the id');
            $(elem).closest('tr').remove();
        },
    );
};

let toggleClass = function (elem, name) {
    $(elem).closest('div').find('*').removeClass('active');
    $(elem).toggleClass(name);
};

let openContainerLayer = function (close, open) {
    $('.container > *').addClass('d-none');
    $(open).removeClass('d-none');
};

let saveAirtableUrls = function (elem) {
    let data = $('.airtableKeys')
        .find('input')
        .get()
        .reduce((total, val) => {
            total = Object.assign(total, {
                [$(val).attr('name')]: $(val).val(),
            });
            return total;
        }, {});

    let test = $('.airtableKeys')
        .find('input')
        .get()
        .some((val) => $(val).val() == '');

    if (test == true) return $(elem).html('Missing fields! Try Again →');

    $(elem).html('Testing Values...');

    $.ajax({
        url: `/${urlParams().brand}/auth/data/saveAirtableURLs/${
            urlParams().collection
        }`,
        method: 'POST',
        data: data,
        success: (val) => {
            $(elem).html(val.success);
            console.log(val);
            openContainerLayer('.airtableKeys', '.airtablePull');
        },
    }).fail((val) => {
        $(elem).html(val.responseText);
        console.log(val);
    });
};

let importAndMerge = function (elem, input) {
    $(elem).html('Importing & Merging...');

    $.ajax({
        url: `/${urlParams().brand}/auth/data/importAndMerge/${
            urlParams().collection
        }`,
        method: 'GET',
        success: (val) => {
            $(elem).html(val.success);
            openContainerLayer('.airtablePull', '.airtableDone');
        },
    }).fail((val) => {
        $(elem).html(val.responseText);
        console.log(val);
    });
};

let reloadPjax = function () {
    let windowUrl = window.location.href;
    $('.btn.pjaxTrigger.active').trigger('click');
};

$(document).on('mouseenter mouseleave', '.info-circle', function () {
    let data = $(this).attr('mydata');
    $('.popover').html(data);
    $(this).toggleClass('hovered');
    $('.popover').toggleClass('d-none');

    if ($('.popover').hasClass('d-none'))
        return console.log('popover disappeared');

    let posn = {
        left: $(this).offset().left,
        top: $(this).offset().top,
        right: $(this).offset().right,
        bottom: $(this).offset().bottom,
    };

    if (posn.left + $('.popover').width() / 2 > $(window).width()) {
        return $('.popover').css({
            left: 'auto',
            right: 5,
            top: posn.top - $('.popover').height() - $(this).height() - 20,
        });
    }

    if (posn.left < $('.popover').width() / 2) {
        // >
        return $('.popover').css({
            left: posn.left,
            top: posn.top - $('.popover').height() - $(this).height() - 20,
        });
    }

    $('.popover').css({
        left: posn.left - $('.popover').width() / 2,
        top: posn.top - $('.popover').height() - $(this).height() - 20,
    });
});

let changeBrand = function (elem) {
    window.location.href = $(elem).val().split(' ')[0];
};

$(document).on('keypress', '.FK', function (event) {
    if (event.which == '13') {
        console.log('enter hit');
        event.preventDefault();
        $(this).find('.card.active').trigger('click');
    }
});

let getTypeOfElem = function (elem) {
    let type = '';

    switch (true) {
        case $(elem).closest('.FK').hasClass('selectFK'):
            type = 'selectFK';
            break;
        case $(elem).closest('.FK').hasClass('quantityFK'):
            type = 'quantityFK';
            break;
        case $(elem).closest('.FK').hasClass('multipleFK'):
            type = 'multipleFK';
            break;
        default:
            break;
    }

    return type;
};

let drawElems = function (elem, val) {
    let type = getTypeOfElem(elem);

    let myArray = val.output;

    myArray.sort(function (a, b) {
        let calcScore = function (val) {
            let output = val.reduce((total, sss) => {
                let cell = Object.entries(sss)[0];
                if (cell[1] == '') return total;
                total = total + cell[1] + ',';
                return total;
            }, '');
            let re = new RegExp($(elem).val() || $(elem).html().trim(), 'i');

            return re.test(output) ? 1 : -1;
        };

        return calcScore(b) - calcScore(a);
    });

    let entries = myArray;

    entries = entries.map((val) => {
        function capitalizeFirstLetter(string) {
            return string.charAt(0).toUpperCase() + string.slice(1);
        }

        let output = val.reduce((total, inner) => {
            let cell = Object.entries(inner)[0];
            let block = {
                hdg: capitalizeFirstLetter(cell[0]),
                dta: cell[1],
            };
            if (
                cell[1] == '' ||
                cell[0] == 'created_at' ||
                cell[0] == 'updatedAt' ||
                cell[0] == '_id'
            ) {
                return total;
            } else if (cell[0] == 'photos') {
                let photos = cell[1].reduce((total, val) => {
                    total += `<img src=${val.medium}></img>`;
                    return total;
                }, '');

                total =
                    total +
                    `
                            <div class="photos">
                                <span>${block.hdg}</span>
                                <div>
                                    ${photos}
                                </div>
                            </div>`;
                return total;
            } else {
                total =
                    total +
                    `<div><span> ${block.hdg} </span> <span> ${block.dta} </span></div>`;
                return total;
            }
        }, '');

        let findings = {
            ser: val.find((sss) => Object.keys(sss)[0] == 'ser').ser,
            slug: val.find((sss) => Object.keys(sss)[0] == 'slug').slug,
            row:
                $(elem).closest('tr').attr('id') ||
                $(elem).closest('form').attr('row'),
            col: $(elem).closest('.fixed').attr('index'),
        };

        return `<div 
                class="card pointer" 
                my-ser="${findings.ser}" 
                my-slug="${findings.slug}" 
                row="${findings.row}" 
                col="${findings.col}" 
                input="${$(elem).attr('index')}" 
                onclick="updateCellFK(this, '${type}')">${output}</div>`;
    });

    entries = entries.reduce((total, val) => (total = total + val), '');

    console.log('show fake screen');
    $('.fakeScreen').removeClass('d-none');

    if (type == 'selectFK') {
        $(elem).closest('.FK').find('.listedFKs').removeClass('d-none');
        $(elem).closest('.FK').find('.listedFKs > .card').remove();
        $(elem).closest('.FK').find('.listedFKs').append(entries);
        $(elem)
            .closest('.FK')
            .find('.listedFKs > .card:eq(0)')
            .addClass('active');

        if ($(elem).prop('tagName') == 'SPAN') {
            $(elem).closest('.FK').find('input').focus();
            $(elem).closest('.FK').find('input').val($(elem).html().trim());
        }
    } else if (type == 'quantityFK') {
        $(elem).closest('.FK').find('.listedFKs > .searchedItems').remove();
        $(elem)
            .closest('.FK')
            .find('.listedFKs')
            .append(`<div class="searchedItems">${entries}</div>`);
        $(elem)
            .closest('.FK')
            .find('.listedFKs .card:eq(0)')
            .addClass('active');
    } else if (type == 'multipleFK') {
        $(elem).closest('.FK').find('.listedFKs > .searchedItems').remove();
        $(elem)
            .closest('.FK')
            .find('.listedFKs')
            .append(`<div class="searchedItems">${entries}</div>`);
        $(elem)
            .closest('.FK')
            .find('.listedFKs .card:eq(0)')
            .addClass('active');

        // ALREADY SELECTED ITEMS ARE MADE DISABLED

        let alreadySelected = $(elem)
            .closest('.FK')
            .find('input')
            .get()
            .map((val) => $(val).val());

        var index = alreadySelected.indexOf($(elem).val() || $(elem).html());
        if (index !== -1) {
            alreadySelected.splice(index, 1);
        }

        alreadySelected.forEach((val) => {
            $(elem)
                .closest('.FK')
                .find(`[my-slug='${val.trim()}'`)
                .get()
                .forEach((val) => {
                    $(val)
                        .addClass('disabled')
                        .removeClass('active pointer')
                        .attr({ onclick: '' });
                    $(val)
                        .siblings('.card:not(.disabled):eq(0)')
                        .addClass('active');
                });
        });
    }
};

let selectFK = function (elem) {
    let FK = $(elem).closest('.selectFK').attr('FK');
    let retrievedObject = localStorage.getItem(FK);

    if (retrievedObject != null) {
        drawElems(elem, JSON.parse(retrievedObject));
    } else {
        $.ajax({
            url: `/${urlParams().brand}/auth/data/fetchCollectionData/${FK}`,
            method: 'get',
            success: (val) => {
                localStorage.setItem(`${FK}`, JSON.stringify(val));
                drawElems(elem, val);
            },
        }).fail((val) => {
            console.log(val);
        });
    }
};

let quantityFK = function (elem) {
    let FK = $(elem).closest('.FK').attr('FK');

    $(elem).closest('.FK').find('.listedFKs').removeClass('d-none');

    if ($(elem).prop('tagName').toLowerCase() != 'input') {
        let value = '';

        if ($(elem).closest('.FK').hasClass('qantityFK')) {
            value = $(elem).html().split(' ')[1];
        } else {
            value = $(elem).html().trim();
        }
        console.log('now focus on the input');
        console.log({ value });
        elem = $(elem).closest('.FK').find(`[value=${value}]`);
        return $(elem).focus();
    }

    let retrievedObject = localStorage.getItem(FK);

    if (retrievedObject != null) {
        drawElems(elem, JSON.parse(retrievedObject));
    } else {
        $.ajax({
            url: `/${urlParams().brand}/auth/data/fetchCollectionData/${FK}`,
            method: 'get',
            success: (val) => {
                localStorage.setItem(`${FK}`, JSON.stringify(val));
                drawElems(elem, val);
            },
        }).fail((val) => {
            console.log(val);
        });
    }
};

let updateCellFK = function (elem, type) {
    $(elem).addClass('active').siblings('.card').removeClass('active');

    let findings = {
        row: $(elem).attr('row'),
        col: $(elem).attr('col'),
        index: $(elem).attr('input'),
        val: $(elem).attr('my-slug') || $(elem).attr('my-ser'),
    };

    Object.assign(findings, {
        elem: $(` [id=${findings.row}] > [index=${findings.col}] `),
        _id: $(` [id=${findings.row}] > [index=col0] `).html().trim(),
    });

    if (type == 'selectFK') {
        $('.fakeScreen').addClass('d-none');

        let html = `
                <span onkeyup="selectFK(this)" onclick="selectFK(this)" contenteditable="true">${findings.val}</span>
                <div class="listedFKs cellBox d-none" type="selectFK">
                    <input type="text" onkeyup="selectFK(this)" value="${findings.val}">
                </div>
            `;

        $(` [id=${findings.row}] > [index=${findings.col}] `).html(html);
        $(elem).closest('.FK').html(html);
        saveInput(findings.elem, findings._id, 'selectFK');
    } else if (type == 'quantityFK' || type == 'multipleFK') {
        $(elem)
            .closest('.FK')
            .find(` input[index=${findings.index}] `)
            .val(findings.val);
        saveQuantityFK(
            $(elem).closest('.FK').find(` input[index=${findings.index}] `),
            type,
        );
        refreshQuantityData($(elem).closest('.FK'));
    }
};

let refreshMyData = function (elem, mydata) {
    mydata = mydata.reduce((total, val) => {
        total.push(val[0]);
        return total;
    }, []);
    let jsonVersion = JSON.stringify(mydata);
    $(elem)
        .find('span')
        .html(mydata.length + 'x photo(s)');
    $(elem).attr({ mydata: jsonVersion });

    if ($(elem).closest('form').attr('row') != 'undefined') {
        let col = $(elem).attr('index');
        let row = $(elem).closest('form').attr('row');
        $(`#${row} > [index=${col}]`).attr({ mydata: jsonVersion });
        $(`#${row} > [index=${col}]`)
            .find('span')
            .html(mydata.length + 'x photo(s)');
    }
};

let uploadImages = function (elem) {
    $('.listedPhotos').remove();

    let mydata = [];

    try {
        mydata = JSON.parse($(elem).closest('.photos').attr('mydata'));
    } catch (e) {
        mydata = [''];
    }

    if (Array.isArray(mydata) == false) {
        mydata = [''];
    }

    let photos = mydata.reduce((total, val) => {
        if (val.hasOwnProperty('medium')) {
            total =
                total +
                `
                        <div class="card img">
                            <img src=${val.medium} width="150" imgId=${val.imgId}>
                            <i class="fas fa-trash" onclick="deleteImg(this)"></i>
                            <i class="fas fa-spinner fa-spin d-none"></i>
                        </div>`;
            return total;
        } else {
            return total;
        }
    }, '');

    let html = `
                <div class="listedPhotos cellBox">
                    ${photos}
                    <div class="card uploadPhoto pointer" onclick="uploadMultipleImages(this)">
                        <i class="fas fa-plus"></i>
                    </div>
                    <input class="d-none" type="file" name="img" accept="image/*" onchange="readPhotosURL(this)" multiple/>
                </div>
            `;

    $(elem).closest('.photos').append(html);
};

let readPhotosURL = function (elem) {
    let td = $(elem).closest('.photos');

    let afterCloudinary = function (val, imgId) {
        let finishUpload = function (mydata) {
            $(`[imgId="${imgId}"]`)
                .attr({ src: val.url })
                .removeClass('uploading');
            $(`[imgId="${imgId}"]`).siblings('.fa-spinner').addClass('d-none');
            refreshMyData(td, mydata.photos);
        };

        let data = {
            _id: getMyId(td),
            photo: {
                imgId: imgId,
                small:
                    'http://res.cloudinary.com/miscellaneous/image/upload/' +
                    'c_scale,h_100,q_100/' +
                    val.url.split(
                        'http://res.cloudinary.com/miscellaneous/image/upload/',
                    )[1],
                medium:
                    'http://res.cloudinary.com/miscellaneous/image/upload/' +
                    'c_scale,h_200,q_100/' +
                    val.url.split(
                        'http://res.cloudinary.com/miscellaneous/image/upload/',
                    )[1],
                large: val.url,
            },
        };

        $.ajax({
            url: `/${urlParams().brand}/auth/data/saveImgInArray/${
                urlParams().collection
            }`,
            method: 'POST',
            data: data,
            success: (val) => finishUpload(val),
            error: (err, status, response) => console.log(err),
        });
    };

    let uploadCloudinary = function (img, imgId) {
        let data = {
            public_id: imgId,
            img: img,
        };

        $.ajax({
            url: `/${urlParams().brand}/auth/data/uploadCloudinary/n`,
            method: 'POST',
            data: data,
            success: (val) => afterCloudinary(val, imgId),
            error: (err, status, response) => console.log(err.responseText),
        });
    };

    let files = Object.values(elem.files);

    files.forEach((val, index) => {
        let html = `<div class="card temp">
                    <i class="fas fa-trash"></i>
                    <i class="fas fa-spinner fa-spin"></i>
                </div>`;
        $(elem).closest('.listedPhotos').find('.card.uploadPhoto').before(html);

        var reader = new FileReader();
        reader.onload = function (e) {
            let imgId =
                Date.now().toString(36) + Math.random().toString(36).substr(2);
            let html = `<div class="card img">
                        <img class="uploading" src=${e.target.result} width="150" imgId="${imgId}">
                        <i class="fas fa-trash" onclick="deleteImg(this)"></i>
                        <i class="fas fa-spinner fa-spin"></i>
                    </div>`;
            $(elem).closest('.listedPhotos').find('.card.temp:eq(0)').remove();
            $(elem)
                .closest('.listedPhotos')
                .find('.card.uploadPhoto')
                .before(html);
            return uploadCloudinary(e.target.result, imgId);
        };

        reader.readAsDataURL(val);
    });

    return;
};

let getMyId = function (elem) {
    elem = $(elem).get().length == 0 ? $('.cellBox:not(.d-none)') : elem;

    let _id = '';
    try {
        _id = $(elem).closest('tr').find('td:eq(1)').html().trim();
    } catch (e) {
        _id = $(elem).closest('form').find("[name='_id'] > span").html().trim();
    }
    return _id;
};

let uploadMultipleImages = function (elem) {
    $(elem).siblings('input').trigger('click');
};

let uploadImage = function (elem) {
    const inputElem =
        $(elem).siblings('input').length > 0
            ? $(elem).siblings('input')
            : $(elem).children('input');

    if (inputElem.length > 0) {
        console.log('Triggering input click');
        inputElem.trigger('click');
    }
};

let deleteImg = function (elem) {
    let td = $(elem).closest('.photos');
    console.log('delete in cloudinary now');

    $(elem).siblings('img').addClass('uploading');
    $(elem).siblings('.fa-spinner').removeClass('d-none');

    let data = {
        _id: getMyId(td),
        imgId: $(elem).siblings('img').attr('imgId'),
    };

    let deleteInImgArray = function (val) {
        let finishUpload = function (mydata) {
            refreshMyData(td, mydata.photos);
            $(elem).closest('.card').remove();
        };

        if (val.result == 'not found') {
            console.log('img not found in cloudinary');
        }

        $.ajax({
            url: `/${urlParams().brand}/auth/data/deleteImgInArray/${
                urlParams().collection
            }`,
            method: 'POST',
            data: data,
            success: (val) => finishUpload(val),
            error: (err, status, response) => console.log(err),
        });
    };

    $.ajax({
        url: `/${urlParams().brand}/auth/data/deleteImgInCloudinary/n`,
        method: 'POST',
        data: data,
        success: (val) => deleteInImgArray(val),
        error: (err, status, response) => console.log(err),
    });
};

let tidyMeUp = function (elem) {
    let currentEmptyFields = $(elem)
        .closest('.FK')
        .find('.cellBox > .static > .fields > input')
        .get()
        .filter((val) => $(val).val().trim() == '');
    $(currentEmptyFields).closest('.fields').remove();
};

let addInputField = function (elem) {
    let type = getTypeOfElem(elem),
        html = '';

    let myId = Date.now().toString(36) + Math.random().toString(36).substr(2);

    if (type == 'quantityFK') {
        html = `
                <div class="fields" myId="${myId}">
                    <p>
                        <button type="button" onclick="changeQuantityFK(this, -1)"><i class="fas fa-minus"></i></button>
                        <span>1</span>
                        <button type="button" onclick="changeQuantityFK(this, 1)"><i class="fas fa-plus"></i></button>
                    </p>
                    <i class="fas fa-times"></i>
                    <input index="${
                        $(elem).siblings('.fields').length + 1
                    }" type="text" onfocus="quantityFK(this)" value="" onkeyup="quantityFK(this); saveQuantityFK(this)">
                    <i onclick="deleteQuantityFK(this)" class="fas fa-trash"></i>
                </div>
            `;
    } else if (type == 'multipleFK') {
        html = `
                <div class="fields items" myId="${myId}">
                    <input index="${
                        $(elem).siblings('.fields').length + 1
                    }" type="text" onfocus="quantityFK(this)" value="" onkeyup="quantityFK(this); saveQuantityFK(this, 'multipleFK')">
                    <i onclick="deleteQuantityFK(this)" class="fas fa-trash"></i>
                </div>
            `;
    }

    $(elem).closest('.FK').find('.cellBox > .static > button').before(html);
    $(elem)
        .closest('.FK')
        .find('.cellBox > .static > .fields:eq(-1) > input')
        .focus();
};

let saveQuantityFK = function (elem, type) {
    $(elem).closest('.static').children('button').html('Saving...');

    let data = {
        _id: getMyId(elem),
        key: $(elem).closest('.FK').attr('key'),
    };

    console.log({ type });

    if (type == 'multipleFK') {
        Object.assign(data, {
            item: {
                id: $(elem).closest('.fields').attr('myId'),
                slug: $(elem).closest('.fields').find('input').val().trim(),
            },
        });
    } else {
        Object.assign(data, {
            item: {
                id: $(elem).closest('.fields').attr('myId'),
                quantity: $(elem)
                    .closest('.fields')
                    .find('p > span')
                    .html()
                    .trim(),
                slug: $(elem).closest('.fields').find('input').val().trim(),
            },
        });
    }

    $.ajax({
        url: `/${urlParams().brand}/auth/data/saveItemInArray/${
            urlParams().collection
        }`,
        method: 'POST',
        data: data,
        success: (val) => {
            console.log(val);
            $(elem)
                .closest('.static')
                .children('button')
                .html("<i class='fas fa-plus'></i>");
        },
    }).fail((error) => {
        console.log(error);
        $(elem).closest('.static').children('button').html('Not Saved. :(');
    });
};

let deleteQuantityFK = function (elem) {
    let data = {
        _id: getMyId(elem),
        key: $(elem).closest('.FK').attr('key'),
        keyId: $(elem).closest('.fields').attr('myId'),
    };

    console.log(data);

    $.ajax({
        url: `/${urlParams().brand}/auth/data/deleteItemInArray/${
            urlParams().collection
        }`,
        method: 'post',
        data: data,
        success: (val) => {
            console.log(val[data.key]);
            let FK = $(elem).closest('.FK');
            $(elem).closest('.fields').remove();
            $(FK).find('[index]:eq(0)').focus();
            refreshQuantityData(FK);
        },
    }).fail((error) => console.log(error));
};

let changeQuantityFK = function (elem, int) {
    let current = $(elem).closest('p').find('span').html().trim();
    let newV = Number(current) + Number(int);
    $(elem).closest('p').find('span').html(newV);
    saveQuantityFK(elem);
    refreshQuantityData($(elem).closest('.FK'));
};

let refreshQuantityData = function (elem) {
    $(elem)
        .find('[index]')
        .get()
        .forEach((val, index) => {
            $(val).attr({ index: index });
        });

    console.log(' refreshing quantity data ');

    let array = [],
        html = '',
        fields = '';

    if (
        $(elem).find('.fields').get() &&
        $(elem).find('.fields').get().length > 0
    ) {
        html = $(elem)
            .find('.fields')
            .get()
            .reduce((total, val) => {
                if ($(val).find('p > span').html() != undefined) {
                    let obj = {
                        id: $(val).attr('myId'),
                        quantity: $(val).find('p > span').html().trim(),
                        slug: $(val).find('input').val().trim(),
                    };
                    array.push(obj);
                    total += `<span class="pointer" onclick="quantityFK(this)" >${obj.quantity}x ${obj.slug}</span>
                        `;
                } else {
                    let obj = {
                        id: $(val).attr('myId'),
                        slug: $(val).find('input').val().trim(),
                    };
                    array.push(obj);
                    total += `<span class="pointer" onclick="quantityFK(this)" >${obj.slug}</span>
                        `;
                }
                return total;
            }, '');

        fields = $(elem)
            .find('.fields')
            .get()
            .reduce((total, val, index) => {
                if ($(val).find('p > span').html() != undefined) {
                    let obj = {
                        id: $(val).attr('myId'),
                        quantity: $(val).find('p > span').html().trim(),
                        slug: $(val).find('input').val().trim(),
                    };

                    total += `
                        <div class="fields" myId="${obj.id}">
                            <p>
                                <button type="button" onclick="changeQuantityFK(this,-1)"><i class="fas fa-minus"></i></button>
                                <span>${obj.quantity}</span>
                                <button type="button" onclick="changeQuantityFK(this,1)"><i class="fas fa-plus"></i></button>
                            </p>
                            <i class="fas fa-times"></i>
                            <input index="${index}" type="text" onfocus="quantityFK(this)" value="${obj.slug}" onkeyup="quantityFK(this); saveQuantityFK(this)">
                            <i onclick="deleteQuantityFK(this)" class="fas fa-trash"></i>
                        </div>`;
                } else {
                    let obj = {
                        id: $(val).attr('myId'),
                        slug: $(val).find('input').val().trim(),
                    };

                    total += `
                        <div class="fields" myId="${obj.id}">
                            <input index="${index}" type="text" onfocus="quantityFK(this)" value="${obj.slug}" onkeyup="quantityFK(this); saveQuantityFK(this,'multipleFK')">
                            <i onclick="deleteQuantityFK(this)" class="fas fa-trash"></i>
                        </div>`;
                }
                return total;
            }, '');
    } else {
        html = `<span class="pointer " onclick="quantityFK(this); tidyMeUp(this); addInputField(this);" >Add ${$(
            elem,
        ).attr('key')}</span>`;
    }

    $(elem).children('span').remove();
    $(elem).children('.cellBox').before(html);
    $(elem).attr({ mydata: JSON.stringify(array) });

    if ($(elem).closest('form').attr('row') != 'undefined') {
        let col = $(elem).attr('index');
        let row = $(elem).closest('form').attr('row');
        $(`#${row} > [index=${col}]`).attr({ mydata: JSON.stringify(array) });
        $(`#${row} > [index=${col}]`).children('span').remove();
        $(`#${row} > [index=${col}]`).children('.cellBox').before(html);
        $(`#${row} > [index=${col}]`)
            .find('.cellBox > .static')
            .html(
                fields +
                    `<button type="button" class="pointer" onclick="addInputField(this)"><i class="fas fa-plus"></i></button>`,
            );
    }

    $(elem).closest('tr').find('.fixed.formula').trigger('onmousedown');
    $(elem).closest('form').find('.fixed.formula').trigger('onmousedown');
};

$(document).on('click', 'th', function () {
    function comparer(index) {
        return function (a, b) {
            var valA = getCellValue(a, index),
                valB = getCellValue(b, index);
            return $.isNumeric(valA) && $.isNumeric(valB)
                ? valA - valB
                : valA.toString().localeCompare(valB);
        };
    }

    function getCellValue(row, index) {
        return $(row).children('td').eq(index).text();
    }

    var table = $(this).parents('table').eq(0);
    var rows = table
        .find('tr:gt(0)')
        .toArray()
        .sort(comparer($(this).index()));
    this.asc = !this.asc;
    if (!this.asc) {
        rows = rows.reverse();
    }
    for (var i = 0; i < rows.length; i++) {
        table.append(rows[i]);
    } // >
});

let changePassword = function (elem, _id, collection) {
    console.log('change password clicked');
    let newPass = $('[name=newPass]').val();
    let cfmPass = $('[name=cfmPass]').val();
    if (newPass == '' || cfmPass == '')
        return $(elem).html('Password field is empty!');
    if (newPass != cfmPass) return $(elem).html('Password mismatch!');
    let data = {
        oldPass: $('[name=oldPass]').val(),
        newPass: $('[name=cfmPass]').val(),
        _id: _id,
        collection: urlParams().collection,
    };
    const url = `/${urlParams().brand}/auth/data/changePassword/${
        urlParams().collection
    }`;
    console.log(url);
    $.ajax({
        url,
        method: 'POST',
        data: data,
        success: (val) => {
            console.log(val);
            $(elem).html('Password changed');
            $(elem)
                .closest('.bar.toggleable')
                .find('.fa-circle-notch')
                .addClass('d-none');
            $(elem)
                .closest('.bar.toggleable')
                .find('.fa-check')
                .removeClass('d-none');
        },
    }).fail((err) => {
        console.log(err);
        $(elem).html(err.responseText);
        $(elem)
            .closest('.bar.toggleable')
            .find('.fa-circle-notch')
            .addClass('d-none');
        $(elem)
            .closest('.bar.toggleable')
            .find('.fa-exclamation')
            .removeClass('d-none');
    });
};

let saveSettings = function (elem, _id, collection) {
    let type = $(elem).attr('type');

    let data = {};

    data[$(elem).attr('name')] = $(elem).val();

    console.log({ _id, collection, data });

    $(elem)
        .closest('.bar.toggleable')
        .find('.fa-circle-notch')
        .removeClass('d-none');
    $(elem).closest('.bar.toggleable').find('.fa-check').addClass('d-none');
    $(elem)
        .closest('.bar.toggleable')
        .find('.fa-exclamation')
        .addClass('d-none');

    let url;
    if ((collection = 'myapp-themes')) {
        url = `/${
            urlParams().brand
        }/auth/data/updateDocumentInThemes/${collection}?_id=${_id}`;
    } else {
        url = `/${
            urlParams().brand
        }/auth/data/updateDocument/${collection}?_id=${_id}`;
    }

    $.ajax({
        url,
        method: 'POST',
        data: data,
        success: (val) => {
            $(elem)
                .closest('.bar.toggleable')
                .find('.fa-circle-notch')
                .addClass('d-none');
            $(elem)
                .closest('.bar.toggleable')
                .find('.fa-check')
                .removeClass('d-none');
        },
    }).fail((err) => {
        console.log(err);
        $(elem)
            .closest('.bar.toggleable')
            .find('.fa-circle-notch')
            .addClass('d-none');
        $(elem)
            .closest('.bar.toggleable')
            .find('.fa-exclamation')
            .removeClass('d-none');
    });
};

let saveSlackAPI = function (elem, _id, collection) {
    let saveMe = function () {
        let d2 = {};
        d2.brandSlackURL = $("[name='brandSlackURL']").val();
        $.ajax({
            url: `/${urlParams().brand}/auth/data/updateDocument/${
                urlParams().collection
            }?_id=${_id}`,
            method: 'POST',
            data: d2,
            success: (val) => {
                console.log(val);
                $(elem).html('Saved successfully!');
                $(elem)
                    .closest('.bar.toggleable')
                    .find('.fa-circle-notch')
                    .addClass('d-none');
                $(elem)
                    .closest('.bar.toggleable')
                    .find('.fa-check')
                    .removeClass('d-none');
            },
        }).fail((err) => {
            console.log(err);
            $(elem).html(
                err.responseText == '{}'
                    ? 'Error. Failed to save the URL.'
                    : err.responseText,
            );
            $(elem)
                .closest('.bar.toggleable')
                .find('.fa-circle-notch')
                .addClass('d-none');
            $(elem)
                .closest('.bar.toggleable')
                .find('.fa-exclamation')
                .removeClass('d-none');
        });
    };

    let data = {
        url: $("[name='brandSlackURL']").val(),
    };

    $(elem).html('Saving...');
    $(elem)
        .closest('.bar.toggleable')
        .find('.fa-circle-notch')
        .removeClass('d-none');
    $(elem).closest('.bar.toggleable').find('.fa-check').addClass('d-none');
    $(elem)
        .closest('.bar.toggleable')
        .find('.fa-exclamation')
        .addClass('d-none');

    console.log(data);

    $.ajax({
        url: `/${urlParams().brand}/auth/data/saveSlackAPI/${
            urlParams().collection
        }?_id=${_id}`,
        method: 'POST',
        data: data,
        success: (val) => {
            console.log(val);
            return saveMe();
        },
    }).fail((err) => {
        console.log(err);
        $(elem).html(
            err.responseText == '{}'
                ? 'Error. Validate input please'
                : err.responseText,
        );
        $(elem)
            .closest('.bar.toggleable')
            .find('.fa-circle-notch')
            .addClass('d-none');
        $(elem)
            .closest('.bar.toggleable')
            .find('.fa-exclamation')
            .removeClass('d-none');
    });
};

let readSinglePhotoURL = function (elem, _id, collection) {
    
    if (!collection) {
        collection = urlParams().collection;
    }

    if (!collection) {
        alert('collection not found');
        return;
    }

    console.log('upload started at: ' + Date.now());
    const start = Date.now();

    $(elem).closest('.imgUpload').addClass('loading');
    $(elem).closest('.uploader').find('.fa-plus').addClass('d-none');
    $(elem).closest('.uploader').find('.fa-circle-notch').removeClass('d-none');

    let afterCloudinary = function (val, imgId) {
        console.log('uploaded in cloudinary: ' + (Date.now() - start) + ' ms');

        let finishUpload = function (response, mydata) {
            $('.imgUpload').removeClass('loading');
            const index = $(elem).closest('.photo').attr('index');
            const row = $(elem).closest('tr').attr('id') || $(elem).closest('form').attr('row');
            const photoElems = row
                ? $(`[row='${row}'], #${row}`).find(`.photo[index='${index}']`)
                : $(elem).closest('.imgUpload');

            photoElems.each((index, photoElem) => {
                const parentDiv = $(photoElem).closest('.photo');
                const img = $(parentDiv).find('img');
                img.attr({ src: val.url, imgId: imgId });
                $(parentDiv).find('.fa-plus').removeClass('d-none');
                $(parentDiv).find('.fa-circle-notch').addClass('d-none');
            });

            console.log(JSON.stringify(mydata[$(elem).attr('name')]));
            console.log(row);
            if (row) {
                $(`#${row}`)
                    .find(`.photo[index='${index}']`)
                    .attr({
                        mydata: JSON.stringify(mydata[$(elem).attr('name')]),
                    });
            }

            console.log('saved in server: ' + (Date.now() - start) + ' ms');
        };

        _id = _id ? _id : getMyId(elem);
        if (!_id) {
            alert ('_id not found');
            return;
        }
        let data = {
            [$(elem).attr('name')]: {
                _id,
                photo: {
                    imgId: imgId,
                    small:
                        'http://res.cloudinary.com/miscellaneous/image/upload/c_scale,h_100,q_100/' +
                        val.url.split(
                            'http://res.cloudinary.com/miscellaneous/image/upload/',
                        )[1],
                    medium:
                        'http://res.cloudinary.com/miscellaneous/image/upload/c_scale,h_200,q_100/' +
                        val.url.split(
                            'http://res.cloudinary.com/miscellaneous/image/upload/',
                        )[1],
                    large: val.url,
                },
            },
        };

        console.log(data);

        let url =
            collection == 'settings'
                ? `/${
                      urlParams().brand
                  }/auth/data/updateDocumentInThemes/n?_id=${_id}`
                : `/${
                      urlParams().brand
                  }/auth/data/updateDocument/${collection}?_id=${_id}`;

        $.ajax({
            url,
            method: 'POST',
            data: data,
            success: (val) => finishUpload(val, data),
            error: (err, status, response) => console.log(err),
        });
    };

    let uploadCloudinary = function (img, imgId) {
        let data = {
            public_id: imgId,
            img: img,
            folder: collection,
        };

        $.ajax({
            url: `/${urlParams().brand}/auth/data/uploadCloudinary/n`,
            method: 'POST',
            data: data,
            success: (val) => afterCloudinary(val, imgId),
            error: (err, status, response) => console.log(err.responseText),
        });
    };

    let loadInReader = function () {
        var reader = new FileReader();

        reader.onload = function (e) {
            let imgId =
                $(elem).closest('.imgUpload').find('img').attr('imgId') ||
                Date.now().toString(36) + Math.random().toString(36).substr(2);
            $(elem)
                .closest('.imgUpload')
                .find('img')
                .attr({ src: e.target.result, imgId: imgId });
            console.log('uploaded in reader: ' + (Date.now() - start) + ' ms');
            return uploadCloudinary(e.target.result, imgId);
        };

        reader.readAsDataURL(elem.files[0]);
    };

    loadInReader();
};

let iframeURL;

window.addEventListener('message', (event) => {
    console.log('Iframe URL:', event.data);
    iframeURL = event.data;
});

const refreshiframe = function () {
    let iframe = $('iframe').get(0);

    if (iframeURL && iframeURL !== '') {
        iframe.src = iframeURL;
    } else {
        iframe.src = iframe.src;
    }
};

$(document).ajaxStop(function () {
    console.log('All AJAX requests have completed.');
    refreshiframe();
});
